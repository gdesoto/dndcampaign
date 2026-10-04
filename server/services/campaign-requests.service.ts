import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, or, eq, desc, count, sql } from 'drizzle-orm'
import { ActivityLogService } from '#server/services/activity-log.service'
import {
  canVoteOnRequest,
  isCreatorOfPendingRequest,
  isModeratableByAccess,
  isVisibleToAccess,
} from '#server/services/campaign-requests.helpers'
import {
  campaignRequestListDefaultPage,
  campaignRequestListDefaultPageSize,
} from '#shared/schemas/campaign-requests'
import type {
  CampaignRequestCreateInput,
  CampaignRequestDecisionInput,
  CampaignRequestListQueryInput,
  CampaignRequestUpdateInput,
} from '#shared/schemas/campaign-requests'
import type {
  CampaignRequestDetail,
  CampaignRequestListItem,
  CampaignRequestListResponse,
} from '#shared/types/campaign-requests'
import {
  hasCampaignDmAccess,
  type ResolvedCampaignAccess,
} from '#server/utils/campaign-auth'
import { apiError } from '#server/utils/http'

const activityLogService = new ActivityLogService()

const toRequestListItem = (
  request: CampaignRequestWithViewerRelations,
  viewerUserId: string,
  access: ResolvedCampaignAccess,
): CampaignRequestListItem => {
  return {
    id: request.id,
    campaignId: request.campaignId,
    createdByUserId: request.createdByUserId,
    createdByName: request.createdByUser.name,
    type: request.type,
    visibility: request.visibility,
    title: request.title,
    description: request.description,
    status: request.status,
    decisionNote: request.decisionNote,
    decidedByUserId: request.decidedByUserId,
    decidedByName: request.decidedByUser?.name || null,
    decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    voteCount: request.voteCount,
    viewerHasVoted: request.votes.some((vote) => vote.userId === viewerUserId),
    canModerate: isModeratableByAccess(access, request.status),
    canEdit: isCreatorOfPendingRequest(viewerUserId, request),
    canCancel: isCreatorOfPendingRequest(viewerUserId, request),
    canVote: canVoteOnRequest(request),
  }
}

const toRequestDetail = (
  request: CampaignRequestWithViewerRelations,
  viewerUserId: string,
  access: ResolvedCampaignAccess,
): CampaignRequestDetail => ({
  ...toRequestListItem(request, viewerUserId, access),
  createdBy: {
    userId: request.createdByUser.id,
    name: request.createdByUser.name,
  },
  decidedBy: request.decidedByUser
    ? {
        userId: request.decidedByUser.id,
        name: request.decidedByUser.name,
      }
    : null,
})

const requestRelations = (viewerUserId: string) => ({
  createdByUser: { columns: { id: true, name: true } },
  decidedByUser: { columns: { id: true, name: true } },
  votes: { columns: { userId: true }, where: eq(tables.campaignRequestVote.userId, viewerUserId), limit: 1 },
}) as const

const requestExtras = {
  voteCount: sql<number>`(select count(*) from "CampaignRequestVote" where "CampaignRequestVote"."campaignRequestId" = "campaignRequest"."id")`.mapWith(Number).as('voteCount'),
}

type CampaignRequestWithViewerRelations = import('#server/db/schema').CampaignRequest & {
  createdByUser: { id: string; name: string }
  decidedByUser: { id: string; name: string } | null
  votes: { userId: string }[]
  voteCount: number
}

const getPagination = (query: CampaignRequestListQueryInput) => {
  const page = query.page || campaignRequestListDefaultPage
  const pageSize = query.pageSize || campaignRequestListDefaultPageSize
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  }
}

export class CampaignRequestsService {
  private async getAuthorizedRequest(
    campaignId: string,
    requestId: string,
    userId: string,
    access: ResolvedCampaignAccess,
  ): Promise<CampaignRequestWithViewerRelations> {
    const request = await db.query.campaignRequest.findFirst({
      where: and(
        eq(tables.campaignRequest.id, requestId),
        eq(tables.campaignRequest.campaignId, campaignId),
      ),
      with: requestRelations(userId),
      extras: requestExtras,
    })

    if (!request) {
      throw apiError(404, 'NOT_FOUND', 'Request not found')
    }

    if (!isVisibleToAccess(access, userId, request)) {
      throw apiError(404, 'NOT_FOUND', 'Request not found')
    }

    return request
  }

  async createRequest(
    access: ResolvedCampaignAccess,
    userId: string,
    input: CampaignRequestCreateInput,
  ): Promise<CampaignRequestDetail> {
    const campaignId = access.campaignId

    const created = await db.transaction((tx) => {
      const row = tx.insert(tables.campaignRequest).values({
        campaignId,
        createdByUserId: userId,
        type: input.type,
        visibility: input.visibility,
        title: input.title,
        description: input.description,
      }).returning().get()!
      return tx.query.campaignRequest.findFirst({
        where: eq(tables.campaignRequest.id, row.id),
        with: requestRelations(userId),
        extras: requestExtras,
      }).sync()!
    }, { behavior: 'immediate' })

    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'campaign.request.created',
      targetType: 'CAMPAIGN_REQUEST',
      targetId: created.id,
      summary: `Created campaign request "${created.title}".`,
      metadata: {
        status: created.status,
        type: created.type,
        visibility: created.visibility,
      },
    })

    return toRequestDetail(created, userId, access)
  }

  async listRequests(
    access: ResolvedCampaignAccess,
    userId: string,
    query: CampaignRequestListQueryInput,
  ): Promise<CampaignRequestListResponse> {
    const campaignId = access.campaignId

    if (query.moderationQueue && !hasCampaignDmAccess(access)) {
      throw apiError(403, 'FORBIDDEN', 'DM access is required for moderation queue')
    }

    const where = and(
      eq(tables.campaignRequest.campaignId, campaignId),
      query.visibility ? eq(tables.campaignRequest.visibility, query.visibility) : undefined,
      query.moderationQueue ? eq(tables.campaignRequest.status, 'PENDING') : query.status ? eq(tables.campaignRequest.status, query.status) : undefined,
      query.type ? eq(tables.campaignRequest.type, query.type) : undefined,
      query.mine ? eq(tables.campaignRequest.createdByUserId, userId) : undefined,
      hasCampaignDmAccess(access) ? undefined : or(
        eq(tables.campaignRequest.visibility, 'PUBLIC'),
        and(eq(tables.campaignRequest.visibility, 'PRIVATE'), eq(tables.campaignRequest.createdByUserId, userId)),
      ),
    )
    const pagination = getPagination(query)
    const { total, rows } = db.transaction((tx) => ({
      total: tx.select({ value: count() }).from(tables.campaignRequest).where(where).get()!.value,
      rows: tx.query.campaignRequest.findMany({
        where: where,
        orderBy: [desc(tables.campaignRequest.createdAt), desc(tables.campaignRequest.id)],
        offset: pagination.skip,
        limit: pagination.take,
        with: requestRelations(userId),
        extras: requestExtras,
      }).sync(),
    }), { behavior: 'immediate' })

    const items = rows.map((row) => toRequestListItem(row, userId, access))
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

  async getRequestById(
    access: ResolvedCampaignAccess,
    requestId: string,
    userId: string,
  ): Promise<CampaignRequestDetail> {
    const campaignId = access.campaignId

    const request = await this.getAuthorizedRequest(campaignId, requestId, userId, access)

    return toRequestDetail(request, userId, access)
  }

  async updateRequest(
    access: ResolvedCampaignAccess,
    requestId: string,
    userId: string,
    input: CampaignRequestUpdateInput,
  ): Promise<CampaignRequestDetail> {
    const campaignId = access.campaignId

    const existing = await this.getAuthorizedRequest(campaignId, requestId, userId, access)

    if (!isCreatorOfPendingRequest(userId, existing)) {
      throw apiError(403, 'FORBIDDEN', 'Only the creator can edit a pending request')
    }

    const updated = await db.transaction((tx) => {
      const row = tx.update(tables.campaignRequest).set({
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      }).where(eq(tables.campaignRequest.id, existing.id)).returning().get()!
      return tx.query.campaignRequest.findFirst({
        where: eq(tables.campaignRequest.id, row.id),
        with: requestRelations(userId),
        extras: requestExtras,
      }).sync()!
    }, { behavior: 'immediate' })

    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'campaign.request.updated',
      targetType: 'CAMPAIGN_REQUEST',
      targetId: updated.id,
      summary: `Updated campaign request "${updated.title}".`,
    })

    return toRequestDetail(updated, userId, access)
  }

  async cancelRequest(
    access: ResolvedCampaignAccess,
    requestId: string,
    userId: string,
  ): Promise<CampaignRequestDetail> {
    const campaignId = access.campaignId

    const existing = await this.getAuthorizedRequest(campaignId, requestId, userId, access)

    if (!isCreatorOfPendingRequest(userId, existing)) {
      throw apiError(403, 'FORBIDDEN', 'Only the creator can cancel a pending request')
    }

    const canceled = await db.transaction((tx) => {
      const row = tx.update(tables.campaignRequest).set({
        status: 'CANCELED',
      }).where(eq(tables.campaignRequest.id, existing.id)).returning().get()!
      return tx.query.campaignRequest.findFirst({
        where: eq(tables.campaignRequest.id, row.id),
        with: requestRelations(userId),
        extras: requestExtras,
      }).sync()!
    }, { behavior: 'immediate' })

    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'campaign.request.canceled',
      targetType: 'CAMPAIGN_REQUEST',
      targetId: canceled.id,
      summary: `Canceled campaign request "${canceled.title}".`,
    })

    return toRequestDetail(canceled, userId, access)
  }

  async addVote(
    access: ResolvedCampaignAccess,
    requestId: string,
    userId: string,
  ): Promise<CampaignRequestDetail> {
    const campaignId = access.campaignId

    const existing = await this.getAuthorizedRequest(campaignId, requestId, userId, access)

    if (!canVoteOnRequest(existing)) {
      throw apiError(409, 'INVALID_REQUEST_STATE', 'Voting is only available for public pending requests')
    }

    const inserted = db.insert(tables.campaignRequestVote).values({
      campaignRequestId: existing.id,
      campaignId,
      userId,
    }).onConflictDoNothing({
      target: [tables.campaignRequestVote.campaignRequestId, tables.campaignRequestVote.userId],
    }).run()

    if (inserted.changes > 0) {
      await activityLogService.log({
        actorUserId: userId,
        campaignId,
        scope: 'CAMPAIGN',
        action: 'campaign.request.vote_added',
        targetType: 'CAMPAIGN_REQUEST',
        targetId: existing.id,
        summary: `Added vote for campaign request "${existing.title}".`,
      })
    }

    const refreshed = await this.getAuthorizedRequest(campaignId, requestId, userId, access)

    return toRequestDetail(refreshed, userId, access)
  }

  async removeMyVote(
    access: ResolvedCampaignAccess,
    requestId: string,
    userId: string,
  ): Promise<CampaignRequestDetail> {
    const campaignId = access.campaignId

    const existing = await this.getAuthorizedRequest(campaignId, requestId, userId, access)

    if (!canVoteOnRequest(existing)) {
      throw apiError(409, 'INVALID_REQUEST_STATE', 'Voting is only available for public pending requests')
    }

    const deleted = await db.delete(tables.campaignRequestVote).where(and(eq(tables.campaignRequestVote.campaignRequestId, existing.id), eq(tables.campaignRequestVote.userId, userId))).run()

    if (deleted.changes > 0) {
      await activityLogService.log({
        actorUserId: userId,
        campaignId,
        scope: 'CAMPAIGN',
        action: 'campaign.request.vote_removed',
        targetType: 'CAMPAIGN_REQUEST',
        targetId: existing.id,
        summary: `Removed vote for campaign request "${existing.title}".`,
      })
    }

    const refreshed = await this.getAuthorizedRequest(campaignId, requestId, userId, access)

    return toRequestDetail(refreshed, userId, access)
  }

  async decideRequest(
    access: ResolvedCampaignAccess,
    requestId: string,
    userId: string,
    input: CampaignRequestDecisionInput,
  ): Promise<CampaignRequestDetail> {
    const campaignId = access.campaignId

    if (!hasCampaignDmAccess(access)) {
      throw apiError(403, 'FORBIDDEN', 'DM access is required to decide requests')
    }

    const existing = await this.getAuthorizedRequest(campaignId, requestId, userId, access)

    if (!isModeratableByAccess(access, existing.status)) {
      throw apiError(409, 'INVALID_REQUEST_STATE', 'Only pending requests can be decided')
    }

    const updated = await db.transaction((tx) => {
      const row = tx.update(tables.campaignRequest).set({
        status: input.decision,
        decisionNote: input.decisionNote || null,
        decidedByUserId: userId,
        decidedAt: new Date(),
      }).where(eq(tables.campaignRequest.id, existing.id)).returning().get()!
      return tx.query.campaignRequest.findFirst({
        where: eq(tables.campaignRequest.id, row.id),
        with: requestRelations(userId),
        extras: requestExtras,
      }).sync()!
    }, { behavior: 'immediate' })

    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: input.decision === 'APPROVED' ? 'campaign.request.approved' : 'campaign.request.denied',
      targetType: 'CAMPAIGN_REQUEST',
      targetId: updated.id,
      summary: `${input.decision === 'APPROVED' ? 'Approved' : 'Denied'} campaign request "${updated.title}".`,
      metadata: {
        decisionNote: updated.decisionNote,
      },
    })

    return toRequestDetail(updated, userId, access)
  }
}
