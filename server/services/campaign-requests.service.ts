import { prisma } from '#server/db/prisma'
import type { Prisma } from '#server/db/prisma-client'
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
    voteCount: request._count.votes,
    viewerHasVoted: request.votes.length > 0,
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

const requestSelect = {
  id: true,
  campaignId: true,
  createdByUserId: true,
  type: true,
  visibility: true,
  title: true,
  description: true,
  status: true,
  decisionNote: true,
  decidedByUserId: true,
  decidedAt: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: {
    select: {
      id: true,
      name: true,
    },
  },
  decidedByUser: {
    select: {
      id: true,
      name: true,
    },
  },
} as const satisfies Prisma.CampaignRequestSelect

const requestSelectForViewer = (viewerUserId: string) => ({
  ...requestSelect,
  votes: {
    where: { userId: viewerUserId },
    select: { userId: true },
    take: 1,
  },
  _count: {
    select: { votes: true },
  },
}) as const satisfies Prisma.CampaignRequestSelect

type CampaignRequestWithViewerRelations = Prisma.CampaignRequestGetPayload<{
  select: ReturnType<typeof requestSelectForViewer>
}>

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
    const request = await prisma.campaignRequest.findFirst({
      where: {
        id: requestId,
        campaignId,
      },
      select: requestSelectForViewer(userId),
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

    const created = await prisma.campaignRequest.create({
      data: {
        campaignId,
        createdByUserId: userId,
        type: input.type,
        visibility: input.visibility,
        title: input.title,
        description: input.description,
      },
      select: requestSelectForViewer(userId),
    })

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

    const visibilityWhere = hasCampaignDmAccess(access)
      ? {}
      : {
          OR: [
            { visibility: 'PUBLIC' as const },
            {
              visibility: 'PRIVATE' as const,
              createdByUserId: userId,
            },
          ],
        }

    const where = {
      campaignId,
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.mine ? { createdByUserId: userId } : {}),
      ...(query.moderationQueue ? { status: 'PENDING' as const } : {}),
      ...visibilityWhere,
    }

    const pagination = getPagination(query)

    const [total, rows] = await prisma.$transaction([
      prisma.campaignRequest.count({ where }),
      prisma.campaignRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
        select: requestSelectForViewer(userId),
      }),
    ])

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

    const updated = await prisma.campaignRequest.update({
      where: { id: existing.id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      select: requestSelectForViewer(userId),
    })

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

    const canceled = await prisma.campaignRequest.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELED',
      },
      select: requestSelectForViewer(userId),
    })

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

    const vote = await prisma.campaignRequestVote.findUnique({
      where: {
        campaignRequestId_userId: {
          campaignRequestId: existing.id,
          userId,
        },
      },
      select: { id: true },
    })

    if (!vote) {
      await prisma.campaignRequestVote.create({
        data: {
          campaignRequestId: existing.id,
          campaignId,
          userId,
        },
      })

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

    const deleted = await prisma.campaignRequestVote.deleteMany({
      where: {
        campaignRequestId: existing.id,
        userId,
      },
    })

    if (deleted.count > 0) {
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

    const updated = await prisma.campaignRequest.update({
      where: { id: existing.id },
      data: {
        status: input.decision,
        decisionNote: input.decisionNote || null,
        decidedByUserId: userId,
        decidedAt: new Date(),
      },
      select: requestSelectForViewer(userId),
    })

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
