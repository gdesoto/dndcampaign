import { prisma } from '#server/db/prisma'
import type { Prisma } from '#server/db/prisma-client'
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
  type ResolvedCampaignAccess,
} from '#server/utils/campaign-auth'
import { apiError } from '#server/utils/http'

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
  private async resolveSessionIds(
    campaignId: string,
    sessionIds: string[]
  ): Promise<string[]> {
    const uniqueIds = uniqueStrings(sessionIds)
    if (!uniqueIds.length) return []

    const found = await prisma.session.findMany({
      where: {
        campaignId,
        id: { in: uniqueIds },
      },
      select: { id: true },
    })
    if (found.length !== uniqueIds.length) {
      throw apiError(400, 'VALIDATION_ERROR', 'One or more sessions do not belong to this campaign')
    }
    return uniqueIds
  }

  private validateDiscoverableHolderVisibility(
    visibility: 'MYSELF' | 'DM' | 'CAMPAIGN'
  ): true {
    if (visibility === 'MYSELF') {
      throw apiError(400, 'VALIDATION_ERROR', 'Discoverable entries require visibility DM or CAMPAIGN', { visibility: 'Discoverable entries cannot be MYSELF' })
    }
    return true
  }

  private async ensureCampaignMemberHolder(
    campaignId: string,
    holderUserId: string | null
  ): Promise<true> {
    if (!holderUserId) return true
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
      throw apiError(400, 'VALIDATION_ERROR', 'Holder must be a campaign member', { holderUserId: 'Select a campaign member as holder' })
    }
    return true
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
  ): Promise<EntryListRow> {
    const row = await prisma.campaignJournalEntry.findFirst({
      where: {
        id: entryId,
        campaignId,
      },
      include: entryInclude,
    })
    if (!row) {
      throw apiError(404, 'NOT_FOUND', 'Journal entry not found')
    }
    if (!isEntryVisibleToUser(access, userId, row)) {
      throw apiError(404, 'NOT_FOUND', 'Journal entry not found')
    }
    return row
  }

  async createEntry(
    access: ResolvedCampaignAccess,
    userId: string,
    input: CampaignJournalCreateInput,
  ): Promise<CampaignJournalEntryDetail> {
    const campaignId = access.campaignId

    const sessionIds = await this.resolveSessionIds(campaignId, input.sessionIds || [])
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
        sessionLinks: sessionIds.length
          ? {
              create: sessionIds.map((sessionId) => ({
                campaignId,
                sessionId,
              })),
            }
          : undefined,
      },
      include: entryInclude,
    })

    return toEntryListItem(created, access, userId)
  }

  async listEntries(
    access: ResolvedCampaignAccess,
    userId: string,
    query: CampaignJournalListQueryInput,
  ): Promise<CampaignJournalListResponse> {
    const campaignId = access.campaignId

    if (query.dmVisible && !hasCampaignDmAccess(access)) {
      throw apiError(403, 'FORBIDDEN', 'DM access is required for dmVisible filter')
    }

    const visibilityWhere = entryVisibilityWhere(access, userId)
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

    const items = rows.map((row) => toEntryListItem(row, access, userId))

    return {
        items,
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
        },
      }
  }

  async getEntryById(
    access: ResolvedCampaignAccess,
    entryId: string,
    userId: string,
  ): Promise<CampaignJournalEntryDetail> {
    const campaignId = access.campaignId

    const entry = await this.getAuthorizedEntry(campaignId, entryId, userId, access)

    return toEntryListItem(entry, access, userId)
  }

  async updateEntry(
    access: ResolvedCampaignAccess,
    entryId: string,
    userId: string,
    input: CampaignJournalUpdateInput,
  ): Promise<CampaignJournalEntryDetail> {
    const campaignId = access.campaignId

    const existing = await this.getAuthorizedEntry(campaignId, entryId, userId, access)
    const isDm = hasCampaignDmAccess(access)

    if (existing.isDiscoverable) {
      const holderCanManageState = canManageDiscoverableHolderState(access, userId, existing)
      if (!holderCanManageState) {
        throw apiError(403, 'FORBIDDEN', 'You do not have permission to edit this discoverable journal entry')
      }

      if (!isDm) {
        const includesNonVisibilityFields =
          input.title !== undefined ||
          input.contentMarkdown !== undefined ||
          input.sessionIds !== undefined ||
          input.tags !== undefined
        if (includesNonVisibilityFields) {
          throw apiError(403, 'FORBIDDEN', 'Only DM-access users can edit discoverable entry content')
        }

        if (input.visibility === 'MYSELF') {
          throw apiError(400, 'VALIDATION_ERROR', 'Discoverable entries cannot be set to MYSELF visibility', { visibility: 'Choose DM or CAMPAIGN visibility' })
        }
      }
    } else if (!canManageEntry(access, userId, existing)) {
      throw apiError(403, 'FORBIDDEN', 'You do not have permission to edit this journal entry')
    }

    if (existing.isDiscoverable && input.visibility) {
      this.validateDiscoverableHolderVisibility(input.visibility)
    }

    const nextContent = input.contentMarkdown ?? existing.contentMarkdown
    const sessionIds = await this.resolveSessionIds(campaignId, input.sessionIds ?? existing.sessionLinks.map((link) => link.session.id))

    const resolvedTags = await this.resolveTagData(campaignId, {
      contentMarkdown: nextContent,
      tags: input.tags,
    })

    const updated = await prisma.$transaction(async (tx) => {
      await tx.campaignJournalTag.deleteMany({
        where: { campaignJournalEntryId: existing.id },
      })
      await tx.campaignJournalEntrySessionLink.deleteMany({
        where: { campaignJournalEntryId: existing.id },
      })

      if (resolvedTags.length) {
        await tx.campaignJournalTag.createMany({
          data: resolvedTags.map((tag) => ({
            campaignJournalEntryId: existing.id,
            campaignId,
            tagType: tag.tagType,
            normalizedLabel: tag.normalizedLabel,
            displayLabel: tag.displayLabel,
            glossaryEntryId: tag.glossaryEntryId,
          })),
        })
      }

      if (sessionIds.length) {
        await tx.campaignJournalEntrySessionLink.createMany({
          data: sessionIds.map((sessionId) => ({
            campaignJournalEntryId: existing.id,
            campaignId,
            sessionId,
          })),
        })
      }

      return tx.campaignJournalEntry.update({
        where: { id: existing.id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.contentMarkdown !== undefined ? { contentMarkdown: input.contentMarkdown } : {}),
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        },
        include: entryInclude,
      })
    })

    return toEntryListItem(updated, access, userId)
  }

  async deleteEntry(
    access: ResolvedCampaignAccess,
    entryId: string,
    userId: string,
  ): Promise<{ id: string }> {
    const campaignId = access.campaignId

    const existing = await this.getAuthorizedEntry(campaignId, entryId, userId, access)
    if (existing.isDiscoverable && !hasCampaignDmAccess(access)) {
      throw apiError(403, 'FORBIDDEN', 'Only DM-access users can delete discoverable journal entries')
    }
    if (!existing.isDiscoverable && !canManageEntry(access, userId, existing)) {
      throw apiError(403, 'FORBIDDEN', 'You do not have permission to delete this journal entry')
    }

    await prisma.campaignJournalEntry.delete({
      where: { id: existing.id },
    })

    return { id: existing.id }
  }

  async updateDiscoverable(
    access: ResolvedCampaignAccess,
    entryId: string,
    userId: string,
    input: CampaignJournalDiscoverableUpdateInput,
  ): Promise<CampaignJournalEntryDetail> {
    const campaignId = access.campaignId
    if (!hasCampaignDmAccess(access)) {
      throw apiError(403, 'FORBIDDEN', 'DM access is required to update discoverable settings')
    }

    await this.ensureCampaignMemberHolder(campaignId, input.holderUserId ?? null)

    const entry = await this.getAuthorizedEntry(campaignId, entryId, userId, access)

    if (input.isDiscoverable && input.visibility) {
      this.validateDiscoverableHolderVisibility(input.visibility)
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.isDiscoverable) {
        const targetVisibility = input.visibility ?? (entry.visibility === 'MYSELF' ? 'DM' : entry.visibility)
        const targetHolderUserId = input.holderUserId === undefined ? entry.holderUserId : input.holderUserId
        const now = new Date()
        const transferAction: CampaignJournalTransferHistoryAction =
          !entry.isDiscoverable || !entry.discoveredAt
            ? 'DISCOVERED'
            : targetHolderUserId !== entry.holderUserId
              ? targetHolderUserId
                ? 'TRANSFERRED'
                : 'UNASSIGNED'
              : 'DISCOVERED'

        const nextDiscoveredAt = entry.discoveredAt || now
        const nextDiscoveredByUserId = entry.discoveredByUserId || userId

        const next = await tx.campaignJournalEntry.update({
          where: { id: entry.id },
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
          campaignJournalEntryId: entry.id,
          fromHolderUserId: entry.holderUserId,
          toHolderUserId: targetHolderUserId,
          actorUserId: userId,
          action: transferAction,
        })

        return next
      }

      const next = await tx.campaignJournalEntry.update({
        where: { id: entry.id },
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
        campaignJournalEntryId: entry.id,
        fromHolderUserId: entry.holderUserId,
        toHolderUserId: null,
        actorUserId: userId,
        action: 'UNASSIGNED',
      })

      return next
    })

    return toEntryListItem(updated, access, userId)
  }

  async discoverEntry(
    access: ResolvedCampaignAccess,
    entryId: string,
    userId: string,
    input: CampaignJournalDiscoverInput,
  ): Promise<CampaignJournalEntryDetail> {
    const campaignId = access.campaignId
    if (!hasCampaignDmAccess(access)) {
      throw apiError(403, 'FORBIDDEN', 'DM access is required to discover journal entries')
    }

    await this.ensureCampaignMemberHolder(campaignId, input.holderUserId)

    const entry = await this.getAuthorizedEntry(campaignId, entryId, userId, access)

    if (input.visibility) {
      this.validateDiscoverableHolderVisibility(input.visibility)
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextVisibility = input.visibility ?? (entry.visibility === 'MYSELF' ? 'DM' : entry.visibility)
      const nextDiscoveredAt = entry.discoveredAt || new Date()
      const nextDiscoveredByUserId = entry.discoveredByUserId || userId
      const next = await tx.campaignJournalEntry.update({
        where: { id: entry.id },
        data: {
          isDiscoverable: true,
          holderUserId: input.holderUserId,
          discoveredAt: nextDiscoveredAt,
          discoveredByUserId: nextDiscoveredByUserId,
          visibility: nextVisibility,
        },
        include: entryInclude,
      })

      const action: CampaignJournalTransferHistoryAction = entry.holderUserId
        ? 'TRANSFERRED'
        : 'DISCOVERED'
      await this.createTransferHistory(tx, {
        campaignId,
        campaignJournalEntryId: entry.id,
        fromHolderUserId: entry.holderUserId,
        toHolderUserId: input.holderUserId,
        actorUserId: userId,
        action,
      })

      return next
    })

    return toEntryListItem(updated, access, userId)
  }

  async transferEntry(
    access: ResolvedCampaignAccess,
    entryId: string,
    userId: string,
    input: CampaignJournalTransferInput,
  ): Promise<CampaignJournalEntryDetail> {
    const campaignId = access.campaignId

    const entry = await this.getAuthorizedEntry(campaignId, entryId, userId, access)

    if (!entry.isDiscoverable) {
      throw apiError(400, 'VALIDATION_ERROR', 'Only discoverable entries can be transferred')
    }

    if (!canManageDiscoverableHolderState(access, userId, entry)) {
      throw apiError(403, 'FORBIDDEN', 'Only DM-access users or current holder can transfer this entry')
    }

    await this.ensureCampaignMemberHolder(campaignId, input.toHolderUserId)

    const nextVisibility = input.visibility ?? entry.visibility
    this.validateDiscoverableHolderVisibility(nextVisibility)

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.campaignJournalEntry.update({
        where: { id: entry.id },
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
        campaignJournalEntryId: entry.id,
        fromHolderUserId: entry.holderUserId,
        toHolderUserId: input.toHolderUserId,
        actorUserId: userId,
        action,
      })

      return next
    })

    return toEntryListItem(updated, access, userId)
  }

  async archiveEntry(
    access: ResolvedCampaignAccess,
    entryId: string,
    userId: string,
    input: CampaignJournalArchiveInput,
  ): Promise<CampaignJournalEntryDetail> {
    const campaignId = access.campaignId

    const entry = await this.getAuthorizedEntry(campaignId, entryId, userId, access)
    if (!canManageDiscoverableHolderState(access, userId, entry)) {
      throw apiError(403, 'FORBIDDEN', 'Only DM-access users or holder can archive this entry')
    }

    const targetArchived = input.archived
    if (entry.isArchived === targetArchived) {
      return toEntryListItem(entry, access, userId)
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.campaignJournalEntry.update({
        where: { id: entry.id },
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
        campaignJournalEntryId: entry.id,
        fromHolderUserId: entry.holderUserId,
        toHolderUserId: entry.holderUserId,
        actorUserId: userId,
        action: targetArchived ? 'ARCHIVED' : 'UNARCHIVED',
      })

      return next
    })

    return toEntryListItem(updated, access, userId)
  }

  async listEntryHistory(
    access: ResolvedCampaignAccess,
    entryId: string,
    userId: string,
    query: CampaignJournalHistoryListQueryInput,
  ): Promise<CampaignJournalHistoryResponse> {
    const campaignId = access.campaignId

    const entry = await this.getAuthorizedEntry(campaignId, entryId, userId, access)

    const pagination = getPagination(query)
    const where = {
      campaignId,
      campaignJournalEntryId: entry.id,
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
        items: rows.map(toTransferHistoryDto),
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
        },
      }
  }

  async listNotifications(
    access: ResolvedCampaignAccess,
    userId: string,
    query: CampaignJournalNotificationListQueryInput,
  ): Promise<CampaignJournalNotificationListResponse> {
    const campaignId = access.campaignId

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
      isEntryVisibleToUser(access, userId, {
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
        items: pagedItems,
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
        },
      }
  }

  async listMemberOptions(access: ResolvedCampaignAccess): Promise<{ items: CampaignJournalMemberOption[] }> {
    const campaignId = access.campaignId

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
        items: members.map((member) => ({
          userId: member.userId,
          name: member.user.name,
          role: member.role,
          hasDmAccess: member.hasDmAccess,
        })),
      }
  }

  async listTags(
    access: ResolvedCampaignAccess,
    userId: string,
    query: CampaignJournalTagListQueryInput,
  ): Promise<CampaignJournalTagListResponse> {
    const campaignId = access.campaignId

    const visibilityWhere = entryVisibilityWhere(access, userId)
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
        items,
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: allItems.length,
          totalPages: Math.max(1, Math.ceil(allItems.length / pagination.pageSize)),
        },
      }
  }

  async suggestTags(
    access: ResolvedCampaignAccess,
    userId: string,
    query: CampaignJournalTagSuggestQueryInput,
  ): Promise<{ items: CampaignJournalTagSuggestion[] }> {
    const result = await this.listTags(
      access,
      userId,
      {
        type: query.type,
        query: query.query,
        page: 1,
        pageSize: query.limit,
      }
    )

    const items: CampaignJournalTagSuggestion[] = result.items.map((item) => ({
      tagType: item.tagType,
      displayLabel: item.displayLabel,
      normalizedLabel: item.normalizedLabel,
      glossaryEntryId: item.glossaryEntryId,
      glossaryEntryName: item.glossaryEntryName,
    }))

    return { items }
  }
}
