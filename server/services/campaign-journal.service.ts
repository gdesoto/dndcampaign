import { prisma } from '#server/db/prisma'
import type { Prisma } from '#server/db/prisma-client'
import type { ServiceResult } from '#server/services/auth.service'
import {
  campaignJournalListDefaultPage,
  campaignJournalListDefaultPageSize,
} from '#shared/schemas/campaign-journal'
import type {
  CampaignJournalCreateInput,
  CampaignJournalListQueryInput,
  CampaignJournalTagListQueryInput,
  CampaignJournalTagSuggestQueryInput,
  CampaignJournalUpdateInput,
} from '#shared/schemas/campaign-journal'
import type {
  CampaignJournalEntryDetail,
  CampaignJournalEntryListItem,
  CampaignJournalListResponse,
  CampaignJournalTag,
  CampaignJournalTagListItem,
  CampaignJournalTagListResponse,
  CampaignJournalTagSuggestion,
} from '#shared/types/campaign-journal'
import {
  extractJournalTagCandidatesFromMarkdown,
  normalizeGlossaryMentionLabel,
  normalizeJournalTagLabel,
} from '#shared/utils/campaign-journal-tags'
import {
  hasCampaignDmAccess,
  resolveCampaignAccess,
  type ResolvedCampaignAccess,
} from '#server/utils/campaign-auth'

const entryInclude = {
  authorUser: {
    select: {
      id: true,
      name: true,
    },
  },
  tags: {
    include: {
      glossaryEntry: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ tagType: 'asc' }, { displayLabel: 'asc' }],
  },
  sessionLinks: {
    include: {
      session: {
        select: {
          id: true,
          title: true,
          sessionNumber: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  },
} satisfies Prisma.CampaignJournalEntryInclude

type EntryListRow = Prisma.CampaignJournalEntryGetPayload<{ include: typeof entryInclude }>

const toTagDto = (tag: EntryListRow['tags'][number]): CampaignJournalTag => {
  if (tag.tagType === 'CUSTOM') {
    return {
      id: tag.id,
      tagType: 'CUSTOM',
      displayLabel: tag.displayLabel,
      normalizedLabel: tag.normalizedLabel,
      glossaryEntryId: null,
      glossaryEntryName: null,
      isOrphanedGlossaryTag: false,
    }
  }

  if (tag.glossaryEntryId && tag.glossaryEntry) {
    return {
      id: tag.id,
      tagType: 'GLOSSARY',
      displayLabel: tag.displayLabel,
      normalizedLabel: tag.normalizedLabel,
      glossaryEntryId: tag.glossaryEntry.id,
      glossaryEntryName: tag.glossaryEntry.name,
      isOrphanedGlossaryTag: false,
    }
  }

  return {
    id: tag.id,
    tagType: 'GLOSSARY',
    displayLabel: tag.displayLabel,
    normalizedLabel: tag.normalizedLabel,
    glossaryEntryId: null,
    glossaryEntryName: null,
    isOrphanedGlossaryTag: true,
  }
}

const isEntryVisibleToUser = (
  access: ResolvedCampaignAccess,
  userId: string,
  entry: Pick<EntryListRow, 'authorUserId' | 'visibility'>
) => {
  if (entry.visibility === 'CAMPAIGN') return true
  if (entry.authorUserId === userId) return true
  if (entry.visibility === 'DM') {
    return hasCampaignDmAccess(access)
  }
  return false
}

const canManageEntry = (
  access: ResolvedCampaignAccess,
  userId: string,
  entry: Pick<EntryListRow, 'authorUserId' | 'visibility'>
) => {
  if (entry.authorUserId === userId) return true
  return hasCampaignDmAccess(access) && isEntryVisibleToUser(access, userId, entry)
}

const toEntryListItem = (
  row: EntryListRow,
  access: ResolvedCampaignAccess,
  userId: string
): CampaignJournalEntryListItem => ({
  id: row.id,
  campaignId: row.campaignId,
  authorUserId: row.authorUserId,
  authorName: row.authorUser.name,
  title: row.title,
  contentMarkdown: row.contentMarkdown,
  visibility: row.visibility,
  sessions: row.sessionLinks.map((link) => ({
    sessionId: link.session.id,
    title: link.session.title,
    sessionNumber: link.session.sessionNumber,
  })),
  tags: row.tags.map(toTagDto),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  canView: isEntryVisibleToUser(access, userId, row),
  canEdit: canManageEntry(access, userId, row),
  canDelete: canManageEntry(access, userId, row),
})

const getPagination = (query: { page?: number; pageSize?: number }) => {
  const page = query.page || campaignJournalListDefaultPage
  const pageSize = query.pageSize || campaignJournalListDefaultPageSize
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  }
}

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)))

const entryVisibilityWhere = (access: ResolvedCampaignAccess, userId: string) => {
  if (hasCampaignDmAccess(access)) {
    return {
      OR: [
        { visibility: 'CAMPAIGN' as const },
        { visibility: 'DM' as const },
        { visibility: 'MYSELF' as const, authorUserId: userId },
      ],
    }
  }

  return {
    OR: [
      { visibility: 'CAMPAIGN' as const },
      { visibility: 'DM' as const, authorUserId: userId },
      { visibility: 'MYSELF' as const, authorUserId: userId },
    ],
  }
}

type ResolvedCreateData = {
  sessionIds: string[]
  tags: Array<
    | {
        tagType: 'CUSTOM'
        normalizedLabel: string
        displayLabel: string
        glossaryEntryId: null
      }
    | {
        tagType: 'GLOSSARY'
        normalizedLabel: string
        displayLabel: string
        glossaryEntryId: string | null
      }
  >
}

export class CampaignJournalService {
  private async resolveAccess(
    campaignId: string,
    userId: string,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<ResolvedCampaignAccess>> {
    const resolved = await resolveCampaignAccess(campaignId, userId, systemRole)
    if (!resolved.exists) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Campaign not found',
      }
    }
    if (!resolved.access) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Campaign access is denied',
      }
    }
    return { ok: true, data: resolved.access }
  }

  private async resolveSessionIds(
    campaignId: string,
    sessionIds: string[]
  ): Promise<ServiceResult<string[]>> {
    const uniqueIds = uniqueStrings(sessionIds)
    if (!uniqueIds.length) return { ok: true, data: [] }

    const found = await prisma.session.findMany({
      where: {
        campaignId,
        id: { in: uniqueIds },
      },
      select: { id: true },
    })
    if (found.length !== uniqueIds.length) {
      return {
        ok: false,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'One or more sessions do not belong to this campaign',
      }
    }
    return { ok: true, data: uniqueIds }
  }

  private async resolveTagData(
    campaignId: string,
    input: Pick<CampaignJournalCreateInput, 'contentMarkdown' | 'tags'>
  ): Promise<ResolvedCreateData['tags']> {
    const extracted = extractJournalTagCandidatesFromMarkdown(input.contentMarkdown)

    const explicitCustom = (input.tags || [])
      .filter((tag): tag is { type: 'CUSTOM'; label: string } => tag.type === 'CUSTOM')
      .map((tag) => tag.label)
      .map(normalizeJournalTagLabel)
      .filter(Boolean)

    const customLabels = uniqueStrings([...explicitCustom, ...extracted.customTags])
    const customTags: ResolvedCreateData['tags'] = customLabels.map((label) => ({
      tagType: 'CUSTOM',
      normalizedLabel: label,
      displayLabel: label,
      glossaryEntryId: null,
    }))

    const explicitGlossaryIds = uniqueStrings(
      (input.tags || [])
        .filter((tag): tag is { type: 'GLOSSARY'; glossaryEntryId: string } => tag.type === 'GLOSSARY')
        .map((tag) => tag.glossaryEntryId)
    )

    const extractedMentionLabels = uniqueStrings(
      extracted.glossaryMentions.map(normalizeGlossaryMentionLabel).filter(Boolean)
    )

    const glossaryById = explicitGlossaryIds.length
      ? await prisma.glossaryEntry.findMany({
          where: {
            campaignId,
            id: { in: explicitGlossaryIds },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : []

    const glossaryByName = extractedMentionLabels.length
      ? await prisma.glossaryEntry.findMany({
          where: {
            campaignId,
            name: { in: extractedMentionLabels },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : []

    const glossaryMap = new Map<string, { id: string; name: string }>()
    for (const entry of glossaryById) glossaryMap.set(entry.id, entry)
    for (const entry of glossaryByName) glossaryMap.set(entry.id, entry)

    const glossaryTags: ResolvedCreateData['tags'] = Array.from(glossaryMap.values()).map((entry) => ({
      tagType: 'GLOSSARY',
      normalizedLabel: normalizeJournalTagLabel(entry.name),
      displayLabel: entry.name,
      glossaryEntryId: entry.id,
    }))

    const dedupeKeySet = new Set<string>()
    const merged: ResolvedCreateData['tags'] = []
    for (const tag of [...customTags, ...glossaryTags]) {
      const key = `${tag.tagType}:${tag.normalizedLabel}:${tag.glossaryEntryId || ''}`
      if (dedupeKeySet.has(key)) continue
      dedupeKeySet.add(key)
      merged.push(tag)
    }

    return merged
  }

  private async getAuthorizedEntry(
    campaignId: string,
    entryId: string,
    userId: string,
    access: ResolvedCampaignAccess
  ): Promise<ServiceResult<EntryListRow>> {
    const row = await prisma.campaignJournalEntry.findFirst({
      where: {
        id: entryId,
        campaignId,
      },
      include: entryInclude,
    })
    if (!row) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Journal entry not found',
      }
    }
    if (!isEntryVisibleToUser(access, userId, row)) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Journal entry not found',
      }
    }
    return { ok: true, data: row }
  }

  async createEntry(
    campaignId: string,
    userId: string,
    input: CampaignJournalCreateInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<CampaignJournalEntryDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const sessionIds = await this.resolveSessionIds(campaignId, input.sessionIds || [])
    if (!sessionIds.ok) return sessionIds
    const resolvedTags = await this.resolveTagData(campaignId, input)

    const created = await prisma.campaignJournalEntry.create({
      data: {
        campaignId,
        authorUserId: userId,
        title: input.title,
        contentMarkdown: input.contentMarkdown,
        visibility: input.visibility,
        tags: resolvedTags.length
          ? {
              create: resolvedTags.map((tag) => ({
                campaignId,
                tagType: tag.tagType,
                normalizedLabel: tag.normalizedLabel,
                displayLabel: tag.displayLabel,
                glossaryEntryId: tag.glossaryEntryId,
              })),
            }
          : undefined,
        sessionLinks: sessionIds.data.length
          ? {
              create: sessionIds.data.map((sessionId) => ({
                campaignId,
                sessionId,
              })),
            }
          : undefined,
      },
      include: entryInclude,
    })

    return { ok: true, data: toEntryListItem(created, access.data, userId) }
  }

  async listEntries(
    campaignId: string,
    userId: string,
    query: CampaignJournalListQueryInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<CampaignJournalListResponse>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    if (query.dmVisible && !hasCampaignDmAccess(access.data)) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'DM access is required for dmVisible filter',
      }
    }

    const visibilityWhere = entryVisibilityWhere(access.data, userId)
    const tagSearch = query.tag ? normalizeJournalTagLabel(query.tag) : undefined

    const where = {
      campaignId,
      ...visibilityWhere,
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.authorId ? { authorUserId: query.authorId } : {}),
      ...(query.mine ? { authorUserId: userId } : {}),
      ...(query.dmVisible ? { visibility: 'DM' as const } : {}),
      ...(query.sessionId
        ? {
            sessionLinks: {
              some: {
                sessionId: query.sessionId,
              },
            },
          }
        : {}),
      ...(query.tagType || tagSearch
        ? {
            tags: {
              some: {
                ...(query.tagType ? { tagType: query.tagType } : {}),
                ...(tagSearch ? { normalizedLabel: tagSearch } : {}),
              },
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search } },
              { contentMarkdown: { contains: query.search } },
              { tags: { some: { displayLabel: { contains: query.search } } } },
            ],
          }
        : {}),
    }

    const pagination = getPagination(query)
    const [total, rows] = await prisma.$transaction([
      prisma.campaignJournalEntry.count({ where }),
      prisma.campaignJournalEntry.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
        include: entryInclude,
      }),
    ])

    const items = rows.map((row) => toEntryListItem(row, access.data, userId))

    return {
      ok: true,
      data: {
        items,
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
        },
      },
    }
  }

  async getEntryById(
    campaignId: string,
    entryId: string,
    userId: string,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<CampaignJournalEntryDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const entry = await this.getAuthorizedEntry(campaignId, entryId, userId, access.data)
    if (!entry.ok) return entry

    return { ok: true, data: toEntryListItem(entry.data, access.data, userId) }
  }

  async updateEntry(
    campaignId: string,
    entryId: string,
    userId: string,
    input: CampaignJournalUpdateInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<CampaignJournalEntryDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const existing = await this.getAuthorizedEntry(campaignId, entryId, userId, access.data)
    if (!existing.ok) return existing
    if (!canManageEntry(access.data, userId, existing.data)) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'You do not have permission to edit this journal entry',
      }
    }

    const nextContent = input.contentMarkdown ?? existing.data.contentMarkdown
    const sessionIds = await this.resolveSessionIds(campaignId, input.sessionIds ?? existing.data.sessionLinks.map((link) => link.session.id))
    if (!sessionIds.ok) return sessionIds

    const resolvedTags = await this.resolveTagData(campaignId, {
      contentMarkdown: nextContent,
      tags: input.tags,
    })

    const updated = await prisma.$transaction(async (tx) => {
      await tx.campaignJournalTag.deleteMany({
        where: { campaignJournalEntryId: existing.data.id },
      })
      await tx.campaignJournalEntrySessionLink.deleteMany({
        where: { campaignJournalEntryId: existing.data.id },
      })

      if (resolvedTags.length) {
        await tx.campaignJournalTag.createMany({
          data: resolvedTags.map((tag) => ({
            campaignJournalEntryId: existing.data.id,
            campaignId,
            tagType: tag.tagType,
            normalizedLabel: tag.normalizedLabel,
            displayLabel: tag.displayLabel,
            glossaryEntryId: tag.glossaryEntryId,
          })),
        })
      }

      if (sessionIds.data.length) {
        await tx.campaignJournalEntrySessionLink.createMany({
          data: sessionIds.data.map((sessionId) => ({
            campaignJournalEntryId: existing.data.id,
            campaignId,
            sessionId,
          })),
        })
      }

      return tx.campaignJournalEntry.update({
        where: { id: existing.data.id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.contentMarkdown !== undefined ? { contentMarkdown: input.contentMarkdown } : {}),
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        },
        include: entryInclude,
      })
    })

    return { ok: true, data: toEntryListItem(updated, access.data, userId) }
  }

  async deleteEntry(
    campaignId: string,
    entryId: string,
    userId: string,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<{ id: string }>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const existing = await this.getAuthorizedEntry(campaignId, entryId, userId, access.data)
    if (!existing.ok) return existing
    if (!canManageEntry(access.data, userId, existing.data)) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'You do not have permission to delete this journal entry',
      }
    }

    await prisma.campaignJournalEntry.delete({
      where: { id: existing.data.id },
    })

    return { ok: true, data: { id: existing.data.id } }
  }

  async listTags(
    campaignId: string,
    userId: string,
    query: CampaignJournalTagListQueryInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<CampaignJournalTagListResponse>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const visibilityWhere = entryVisibilityWhere(access.data, userId)
    const queryLabel = query.query ? normalizeJournalTagLabel(query.query) : undefined

    const rows = await prisma.campaignJournalTag.findMany({
      where: {
        campaignId,
        ...(query.type ? { tagType: query.type } : {}),
        ...(queryLabel ? { normalizedLabel: { contains: queryLabel } } : {}),
        entry: visibilityWhere,
      },
      select: {
        tagType: true,
        displayLabel: true,
        normalizedLabel: true,
        glossaryEntryId: true,
        glossaryEntry: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const map = new Map<string, CampaignJournalTagListItem>()
    for (const row of rows) {
      const key = `${row.tagType}:${row.normalizedLabel}:${row.glossaryEntryId || ''}`
      if (!map.has(key)) {
        map.set(key, {
          tagType: row.tagType,
          displayLabel: row.displayLabel,
          normalizedLabel: row.normalizedLabel,
          usageCount: 0,
          glossaryEntryId: row.glossaryEntryId,
          glossaryEntryName: row.glossaryEntry?.name || null,
          isOrphanedGlossaryTag: row.tagType === 'GLOSSARY' && !row.glossaryEntryId,
        })
      }
      const current = map.get(key)!
      current.usageCount += 1
    }

    const allItems = Array.from(map.values()).sort((a, b) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount
      return a.displayLabel.localeCompare(b.displayLabel)
    })
    const pagination = getPagination(query)
    const start = pagination.skip
    const end = start + pagination.take
    const items = allItems.slice(start, end)

    return {
      ok: true,
      data: {
        items,
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: allItems.length,
          totalPages: Math.max(1, Math.ceil(allItems.length / pagination.pageSize)),
        },
      },
    }
  }

  async suggestTags(
    campaignId: string,
    userId: string,
    query: CampaignJournalTagSuggestQueryInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<{ items: CampaignJournalTagSuggestion[] }>> {
    const result = await this.listTags(
      campaignId,
      userId,
      {
        type: query.type,
        query: query.query,
        page: 1,
        pageSize: query.limit,
      },
      systemRole
    )
    if (!result.ok) return result

    const items: CampaignJournalTagSuggestion[] = result.data.items.map((item) => ({
      tagType: item.tagType,
      displayLabel: item.displayLabel,
      normalizedLabel: item.normalizedLabel,
      glossaryEntryId: item.glossaryEntryId,
      glossaryEntryName: item.glossaryEntryName,
    }))

    return { ok: true, data: { items } }
  }
}
