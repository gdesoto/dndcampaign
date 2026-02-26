import { prisma } from '#server/db/prisma'
import type { Prisma } from '#server/db/prisma-client'
import type { ServiceResult } from '#server/services/auth.service'
import {
  campaignJournalListMaxPageSize,
  campaignJournalListDefaultPage,
  campaignJournalListDefaultPageSize,
} from '#shared/schemas/campaign-journal'
import type {
  CampaignJournalArchiveInput,
  CampaignJournalCreateInput,
  CampaignJournalDiscoverInput,
  CampaignJournalDiscoverableUpdateInput,
  CampaignJournalHistoryListQueryInput,
  CampaignJournalListQueryInput,
  CampaignJournalNotificationListQueryInput,
  CampaignJournalTagListQueryInput,
  CampaignJournalTagSuggestQueryInput,
  CampaignJournalTransferInput,
  CampaignJournalUpdateInput,
} from '#shared/schemas/campaign-journal'
import type {
  CampaignJournalEntryDetail,
  CampaignJournalEntryListItem,
  CampaignJournalHistoryResponse,
  CampaignJournalListResponse,
  CampaignJournalMemberOption,
  CampaignJournalNotificationType,
  CampaignJournalNotificationListResponse,
  CampaignJournalTag,
  CampaignJournalTagListItem,
  CampaignJournalTagListResponse,
  CampaignJournalTagSuggestion,
  CampaignJournalTransferHistoryAction,
  CampaignJournalTransferHistoryItem,
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

const JOURNAL_NOTIFICATION_RETENTION_DAYS = 30

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
  holderUser: {
    select: {
      id: true,
      name: true,
    },
  },
  discoveredByUser: {
    select: {
      id: true,
      name: true,
    },
  },
  archivedByUser: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.CampaignJournalEntryInclude

type EntryListRow = Prisma.CampaignJournalEntryGetPayload<{ include: typeof entryInclude }>
type EntryVisibilityRow = Pick<
  EntryListRow,
  'authorUserId' | 'holderUserId' | 'visibility' | 'isDiscoverable' | 'isArchived'
>

const transferHistoryInclude = {
  actorUser: {
    select: {
      id: true,
      name: true,
    },
  },
  fromHolderUser: {
    select: {
      id: true,
      name: true,
    },
  },
  toHolderUser: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.CampaignJournalEntryTransferHistoryInclude

type TransferHistoryRow = Prisma.CampaignJournalEntryTransferHistoryGetPayload<{
  include: typeof transferHistoryInclude
}>

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
  entry: EntryVisibilityRow
) => {
  if (entry.isDiscoverable) {
    if (hasCampaignDmAccess(access)) return true
    if (entry.holderUserId === userId) return true
    return entry.visibility === 'CAMPAIGN'
  }

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
  entry: EntryVisibilityRow
) => {
  if (entry.isDiscoverable) {
    return hasCampaignDmAccess(access)
  }

  if (entry.authorUserId === userId) return true
  return hasCampaignDmAccess(access) && isEntryVisibleToUser(access, userId, entry)
}

const canManageDiscoverableHolderState = (
  access: ResolvedCampaignAccess,
  userId: string,
  entry: EntryVisibilityRow
) => hasCampaignDmAccess(access) || (entry.isDiscoverable && entry.holderUserId === userId)

const toTransferHistoryDto = (row: TransferHistoryRow): CampaignJournalTransferHistoryItem => ({
  id: row.id,
  campaignJournalEntryId: row.campaignJournalEntryId,
  campaignId: row.campaignId,
  fromHolderUserId: row.fromHolderUserId,
  fromHolderUserName: row.fromHolderUser?.name || null,
  toHolderUserId: row.toHolderUserId,
  toHolderUserName: row.toHolderUser?.name || null,
  actorUserId: row.actorUserId,
  actorUserName: row.actorUser.name,
  action: row.action as CampaignJournalTransferHistoryAction,
  createdAt: row.createdAt.toISOString(),
})

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
  holderUserId: row.holderUserId,
  holderUserName: row.holderUser?.name || null,
  isDiscoverable: row.isDiscoverable,
  discoveredAt: row.discoveredAt?.toISOString() || null,
  discoveredByUserId: row.discoveredByUserId,
  discoveredByUserName: row.discoveredByUser?.name || null,
  isArchived: row.isArchived,
  archivedAt: row.archivedAt?.toISOString() || null,
  archivedByUserId: row.archivedByUserId,
  archivedByUserName: row.archivedByUser?.name || null,
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
  canDelete: row.isDiscoverable ? hasCampaignDmAccess(access) : canManageEntry(access, userId, row),
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
        { isDiscoverable: true },
        { isDiscoverable: false, visibility: 'CAMPAIGN' as const },
        { isDiscoverable: false, visibility: 'DM' as const },
        { isDiscoverable: false, visibility: 'MYSELF' as const, authorUserId: userId },
      ],
    }
  }

  return {
    OR: [
      { isDiscoverable: false, visibility: 'CAMPAIGN' as const },
      { isDiscoverable: false, visibility: 'DM' as const, authorUserId: userId },
      { isDiscoverable: false, visibility: 'MYSELF' as const, authorUserId: userId },
      { isDiscoverable: true, holderUserId: userId },
      { isDiscoverable: true, visibility: 'CAMPAIGN' as const },
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

  private validateDiscoverableHolderVisibility(
    visibility: 'MYSELF' | 'DM' | 'CAMPAIGN'
  ): ServiceResult<true> {
    if (visibility === 'MYSELF') {
      return {
        ok: false,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Discoverable entries require visibility DM or CAMPAIGN',
        fields: { visibility: 'Discoverable entries cannot be MYSELF' },
      }
    }
    return { ok: true, data: true }
  }

  private async ensureCampaignMemberHolder(
    campaignId: string,
    holderUserId: string | null
  ): Promise<ServiceResult<true>> {
    if (!holderUserId) return { ok: true, data: true }
    const holderMembership = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId,
          userId: holderUserId,
        },
      },
      select: { id: true },
    })
    if (!holderMembership) {
      return {
        ok: false,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Holder must be a campaign member',
        fields: { holderUserId: 'Select a campaign member as holder' },
      }
    }
    return { ok: true, data: true }
  }

  private async createTransferHistory(
    tx: Prisma.TransactionClient,
    input: {
      campaignId: string
      campaignJournalEntryId: string
      fromHolderUserId: string | null
      toHolderUserId: string | null
      actorUserId: string
      action: CampaignJournalTransferHistoryAction
    }
  ) {
    await tx.campaignJournalEntryTransferHistory.create({
      data: {
        campaignId: input.campaignId,
        campaignJournalEntryId: input.campaignJournalEntryId,
        fromHolderUserId: input.fromHolderUserId,
        toHolderUserId: input.toHolderUserId,
        actorUserId: input.actorUserId,
        action: input.action,
      },
    })
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
    const recentlyDiscoveredSince = new Date(Date.now() - JOURNAL_NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000)

    const where = {
      campaignId,
      ...visibilityWhere,
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.authorId ? { authorUserId: query.authorId } : {}),
      ...(query.mine ? { authorUserId: userId } : {}),
      ...(query.discoverable !== undefined ? { isDiscoverable: query.discoverable } : {}),
      ...(query.heldByMe ? { isDiscoverable: true, holderUserId: userId } : {}),
      ...(query.archived !== undefined
        ? { isArchived: query.archived }
        : query.includeArchived
          ? {}
          : { isArchived: false }),
      ...(query.recentlyDiscovered
        ? {
            isDiscoverable: true,
            discoveredAt: {
              gte: recentlyDiscoveredSince,
            },
          }
        : {}),
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
    const isDm = hasCampaignDmAccess(access.data)

    if (existing.data.isDiscoverable) {
      const holderCanManageState = canManageDiscoverableHolderState(access.data, userId, existing.data)
      if (!holderCanManageState) {
        return {
          ok: false,
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'You do not have permission to edit this discoverable journal entry',
        }
      }

      if (!isDm) {
        const includesNonVisibilityFields =
          input.title !== undefined ||
          input.contentMarkdown !== undefined ||
          input.sessionIds !== undefined ||
          input.tags !== undefined
        if (includesNonVisibilityFields) {
          return {
            ok: false,
            statusCode: 403,
            code: 'FORBIDDEN',
            message: 'Only DM-access users can edit discoverable entry content',
          }
        }

        if (input.visibility === 'MYSELF') {
          return {
            ok: false,
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Discoverable entries cannot be set to MYSELF visibility',
            fields: { visibility: 'Choose DM or CAMPAIGN visibility' },
          }
        }
      }
    } else if (!canManageEntry(access.data, userId, existing.data)) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'You do not have permission to edit this journal entry',
      }
    }

    if (existing.data.isDiscoverable && input.visibility) {
      const visibilityResult = this.validateDiscoverableHolderVisibility(input.visibility)
      if (!visibilityResult.ok) return visibilityResult
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
    if (existing.data.isDiscoverable && !hasCampaignDmAccess(access.data)) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only DM-access users can delete discoverable journal entries',
      }
    }
    if (!existing.data.isDiscoverable && !canManageEntry(access.data, userId, existing.data)) {
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

  async updateDiscoverable(
    campaignId: string,
    entryId: string,
    userId: string,
    input: CampaignJournalDiscoverableUpdateInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<CampaignJournalEntryDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access
    if (!hasCampaignDmAccess(access.data)) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'DM access is required to update discoverable settings',
      }
    }

    const holderCheck = await this.ensureCampaignMemberHolder(campaignId, input.holderUserId ?? null)
    if (!holderCheck.ok) return holderCheck

    const entry = await this.getAuthorizedEntry(campaignId, entryId, userId, access.data)
    if (!entry.ok) return entry

    if (input.isDiscoverable && input.visibility) {
      const visibilityCheck = this.validateDiscoverableHolderVisibility(input.visibility)
      if (!visibilityCheck.ok) return visibilityCheck
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.isDiscoverable) {
        const targetVisibility = input.visibility ?? (entry.data.visibility === 'MYSELF' ? 'DM' : entry.data.visibility)
        const targetHolderUserId = input.holderUserId === undefined ? entry.data.holderUserId : input.holderUserId
        const now = new Date()
        const transferAction: CampaignJournalTransferHistoryAction =
          !entry.data.isDiscoverable || !entry.data.discoveredAt
            ? 'DISCOVERED'
            : targetHolderUserId !== entry.data.holderUserId
              ? targetHolderUserId
                ? 'TRANSFERRED'
                : 'UNASSIGNED'
              : 'DISCOVERED'

        const nextDiscoveredAt = entry.data.discoveredAt || now
        const nextDiscoveredByUserId = entry.data.discoveredByUserId || userId

        const next = await tx.campaignJournalEntry.update({
          where: { id: entry.data.id },
          data: {
            isDiscoverable: true,
            holderUserId: targetHolderUserId,
            discoveredAt: nextDiscoveredAt,
            discoveredByUserId: nextDiscoveredByUserId,
            visibility: targetVisibility,
          },
          include: entryInclude,
        })

        await this.createTransferHistory(tx, {
          campaignId,
          campaignJournalEntryId: entry.data.id,
          fromHolderUserId: entry.data.holderUserId,
          toHolderUserId: targetHolderUserId,
          actorUserId: userId,
          action: transferAction,
        })

        return next
      }

      const next = await tx.campaignJournalEntry.update({
        where: { id: entry.data.id },
        data: {
          isDiscoverable: false,
          holderUserId: null,
          discoveredAt: null,
          discoveredByUserId: null,
        },
        include: entryInclude,
      })

      await this.createTransferHistory(tx, {
        campaignId,
        campaignJournalEntryId: entry.data.id,
        fromHolderUserId: entry.data.holderUserId,
        toHolderUserId: null,
        actorUserId: userId,
        action: 'UNASSIGNED',
      })

      return next
    })

    return { ok: true, data: toEntryListItem(updated, access.data, userId) }
  }

  async discoverEntry(
    campaignId: string,
    entryId: string,
    userId: string,
    input: CampaignJournalDiscoverInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<CampaignJournalEntryDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access
    if (!hasCampaignDmAccess(access.data)) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'DM access is required to discover journal entries',
      }
    }

    const holderCheck = await this.ensureCampaignMemberHolder(campaignId, input.holderUserId)
    if (!holderCheck.ok) return holderCheck

    const entry = await this.getAuthorizedEntry(campaignId, entryId, userId, access.data)
    if (!entry.ok) return entry

    if (input.visibility) {
      const visibilityCheck = this.validateDiscoverableHolderVisibility(input.visibility)
      if (!visibilityCheck.ok) return visibilityCheck
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextVisibility = input.visibility ?? (entry.data.visibility === 'MYSELF' ? 'DM' : entry.data.visibility)
      const nextDiscoveredAt = entry.data.discoveredAt || new Date()
      const nextDiscoveredByUserId = entry.data.discoveredByUserId || userId
      const next = await tx.campaignJournalEntry.update({
        where: { id: entry.data.id },
        data: {
          isDiscoverable: true,
          holderUserId: input.holderUserId,
          discoveredAt: nextDiscoveredAt,
          discoveredByUserId: nextDiscoveredByUserId,
          visibility: nextVisibility,
        },
        include: entryInclude,
      })

      const action: CampaignJournalTransferHistoryAction = entry.data.holderUserId
        ? 'TRANSFERRED'
        : 'DISCOVERED'
      await this.createTransferHistory(tx, {
        campaignId,
        campaignJournalEntryId: entry.data.id,
        fromHolderUserId: entry.data.holderUserId,
        toHolderUserId: input.holderUserId,
        actorUserId: userId,
        action,
      })

      return next
    })

    return { ok: true, data: toEntryListItem(updated, access.data, userId) }
  }

  async transferEntry(
    campaignId: string,
    entryId: string,
    userId: string,
    input: CampaignJournalTransferInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<CampaignJournalEntryDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const entry = await this.getAuthorizedEntry(campaignId, entryId, userId, access.data)
    if (!entry.ok) return entry

    if (!entry.data.isDiscoverable) {
      return {
        ok: false,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Only discoverable entries can be transferred',
      }
    }

    if (!canManageDiscoverableHolderState(access.data, userId, entry.data)) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only DM-access users or current holder can transfer this entry',
      }
    }

    const holderCheck = await this.ensureCampaignMemberHolder(campaignId, input.toHolderUserId)
    if (!holderCheck.ok) return holderCheck

    const nextVisibility = input.visibility ?? entry.data.visibility
    const visibilityCheck = this.validateDiscoverableHolderVisibility(nextVisibility)
    if (!visibilityCheck.ok) return visibilityCheck

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.campaignJournalEntry.update({
        where: { id: entry.data.id },
        data: {
          holderUserId: input.toHolderUserId,
          visibility: nextVisibility,
          isDiscoverable: true,
        },
        include: entryInclude,
      })

      const action: CampaignJournalTransferHistoryAction = input.toHolderUserId ? 'TRANSFERRED' : 'UNASSIGNED'
      await this.createTransferHistory(tx, {
        campaignId,
        campaignJournalEntryId: entry.data.id,
        fromHolderUserId: entry.data.holderUserId,
        toHolderUserId: input.toHolderUserId,
        actorUserId: userId,
        action,
      })

      return next
    })

    return { ok: true, data: toEntryListItem(updated, access.data, userId) }
  }

  async archiveEntry(
    campaignId: string,
    entryId: string,
    userId: string,
    input: CampaignJournalArchiveInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<CampaignJournalEntryDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const entry = await this.getAuthorizedEntry(campaignId, entryId, userId, access.data)
    if (!entry.ok) return entry
    if (!canManageDiscoverableHolderState(access.data, userId, entry.data)) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only DM-access users or holder can archive this entry',
      }
    }

    const targetArchived = input.archived
    if (entry.data.isArchived === targetArchived) {
      return { ok: true, data: toEntryListItem(entry.data, access.data, userId) }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.campaignJournalEntry.update({
        where: { id: entry.data.id },
        data: targetArchived
          ? {
              isArchived: true,
              archivedAt: new Date(),
              archivedByUserId: userId,
            }
          : {
              isArchived: false,
              archivedAt: null,
              archivedByUserId: null,
            },
        include: entryInclude,
      })

      await this.createTransferHistory(tx, {
        campaignId,
        campaignJournalEntryId: entry.data.id,
        fromHolderUserId: entry.data.holderUserId,
        toHolderUserId: entry.data.holderUserId,
        actorUserId: userId,
        action: targetArchived ? 'ARCHIVED' : 'UNARCHIVED',
      })

      return next
    })

    return { ok: true, data: toEntryListItem(updated, access.data, userId) }
  }

  async listEntryHistory(
    campaignId: string,
    entryId: string,
    userId: string,
    query: CampaignJournalHistoryListQueryInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<CampaignJournalHistoryResponse>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const entry = await this.getAuthorizedEntry(campaignId, entryId, userId, access.data)
    if (!entry.ok) return entry

    const pagination = getPagination(query)
    const where = {
      campaignId,
      campaignJournalEntryId: entry.data.id,
    }

    const [total, rows] = await prisma.$transaction([
      prisma.campaignJournalEntryTransferHistory.count({ where }),
      prisma.campaignJournalEntryTransferHistory.findMany({
        where,
        include: transferHistoryInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
    ])

    return {
      ok: true,
      data: {
        items: rows.map(toTransferHistoryDto),
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
        },
      },
    }
  }

  async listNotifications(
    campaignId: string,
    userId: string,
    query: CampaignJournalNotificationListQueryInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<CampaignJournalNotificationListResponse>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const retentionFloor = new Date(Date.now() - JOURNAL_NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const sinceFilter = query.since ? new Date(query.since) : null
    const createdAt = sinceFilter && sinceFilter > retentionFloor ? sinceFilter : retentionFloor
    const pagination = getPagination({
      page: query.page,
      pageSize: Math.min(query.pageSize || campaignJournalListDefaultPageSize, campaignJournalListMaxPageSize),
    })

    const historyRows = await prisma.campaignJournalEntryTransferHistory.findMany({
      where: {
        campaignId,
        createdAt: { gte: createdAt },
        ...(query.type
          ? {
              action:
                query.type === 'DISCOVERED'
                  ? 'DISCOVERED'
                  : query.type === 'TRANSFERRED'
                    ? 'TRANSFERRED'
                    : query.type === 'ARCHIVED'
                      ? 'ARCHIVED'
                      : 'UNARCHIVED',
            }
          : {}),
      },
      include: {
        ...transferHistoryInclude,
        entry: {
          select: {
            id: true,
            title: true,
            visibility: true,
            authorUserId: true,
            holderUserId: true,
            isDiscoverable: true,
            isArchived: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })

    const visibleRows = historyRows.filter((row) =>
      isEntryVisibleToUser(access.data, userId, {
        authorUserId: row.entry.authorUserId,
        holderUserId: row.entry.holderUserId,
        visibility: row.entry.visibility,
        isDiscoverable: row.entry.isDiscoverable,
        isArchived: row.entry.isArchived,
      })
    )

    const items = visibleRows
      .map((row) => {
        const type: CampaignJournalNotificationType | null =
          row.action === 'DISCOVERED'
            ? 'DISCOVERED'
            : row.action === 'TRANSFERRED'
              ? 'TRANSFERRED'
              : row.action === 'ARCHIVED'
                ? 'ARCHIVED'
                : row.action === 'UNARCHIVED'
                  ? 'UNARCHIVED'
                  : null
        if (!type) return null

        const toName = row.toHolderUser?.name || 'Unassigned'
        const fromName = row.fromHolderUser?.name || 'Unassigned'
        const actorName = row.actorUser.name
        const message =
          type === 'DISCOVERED'
            ? `${actorName} discovered "${row.entry.title}" for ${toName}.`
            : type === 'TRANSFERRED'
              ? `${actorName} transferred "${row.entry.title}" from ${fromName} to ${toName}.`
              : type === 'ARCHIVED'
                ? `${actorName} archived "${row.entry.title}".`
                : `${actorName} unarchived "${row.entry.title}".`

        return {
          id: row.id,
          campaignId: row.campaignId,
          entryId: row.entry.id,
          type,
          title: row.entry.title,
          message,
          actorUserId: row.actorUserId,
          actorUserName: row.actorUser.name,
          createdAt: row.createdAt.toISOString(),
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    const total = items.length
    const pagedItems = items.slice(pagination.skip, pagination.skip + pagination.take)

    return {
      ok: true,
      data: {
        items: pagedItems,
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
        },
      },
    }
  }

  async listMemberOptions(
    campaignId: string,
    userId: string,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ): Promise<ServiceResult<{ items: CampaignJournalMemberOption[] }>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const members = await prisma.campaignMember.findMany({
      where: { campaignId },
      select: {
        userId: true,
        role: true,
        hasDmAccess: true,
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    })

    return {
      ok: true,
      data: {
        items: members.map((member) => ({
          userId: member.userId,
          name: member.user.name,
          role: member.role,
          hasDmAccess: member.hasDmAccess,
        })),
      },
    }
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
