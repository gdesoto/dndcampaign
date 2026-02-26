import { prisma } from '#server/db/prisma'
import type { CampaignRequestStatus } from '#server/db/prisma-client'
import { ActivityLogService } from '#server/services/activity-log.service'
import type { ServiceResult } from '#server/services/auth.service'
import {
  canCancelRequest,
  canEditRequest,
  canVoteOnRequest,
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
  CampaignRequestStatus as RequestStatus,
} from '#shared/types/campaign-requests'
import {
  hasCampaignDmAccess,
  resolveCampaignAccess,
  type ResolvedCampaignAccess,
} from '#server/utils/campaign-auth'

const activityLogService = new ActivityLogService()

type RequestWithRelations = {
  id: string
  campaignId: string
  createdByUserId: string
  type: 'ITEM' | 'PLOT_POINT'
  visibility: 'PRIVATE' | 'PUBLIC'
  title: string
  description: string
  status: CampaignRequestStatus
  decisionNote: string | null
  decidedByUserId: string | null
  decidedAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdByUser: {
    id: string
    name: string
  }
  decidedByUser: {
    id: string
    name: string
  } | null
  votes: Array<{ userId: string }>
  _count: {
    votes: number
  }
}

const toStatus = (status: CampaignRequestStatus): RequestStatus => status

const toRequestListItem = (
  request: RequestWithRelations,
  viewerUserId: string,
  access: ResolvedCampaignAccess,
): CampaignRequestListItem => {
  const requestForChecks = {
    createdByUserId: request.createdByUserId,
    visibility: request.visibility,
    status: toStatus(request.status),
  }

  return {
    id: request.id,
    campaignId: request.campaignId,
    createdByUserId: request.createdByUserId,
    createdByName: request.createdByUser.name,
    type: request.type,
    visibility: request.visibility,
    title: request.title,
    description: request.description,
    status: toStatus(request.status),
    decisionNote: request.decisionNote,
    decidedByUserId: request.decidedByUserId,
    decidedByName: request.decidedByUser?.name || null,
    decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    voteCount: request._count.votes,
    viewerHasVoted: request.votes.length > 0,
    canModerate: isModeratableByAccess(access, toStatus(request.status)),
    canEdit: canEditRequest(viewerUserId, requestForChecks),
    canCancel: canCancelRequest(viewerUserId, requestForChecks),
    canVote: canVoteOnRequest(requestForChecks),
  }
}

const toRequestDetail = (
  request: RequestWithRelations,
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
} as const

const requestIncludeForViewer = (viewerUserId: string) => ({
  ...requestSelect,
  votes: {
    where: { userId: viewerUserId },
    select: { userId: true },
    take: 1,
  },
  _count: {
    select: { votes: true },
  },
})

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
  private async resolveAccess(
    campaignId: string,
    userId: string,
    systemRole?: 'USER' | 'SYSTEM_ADMIN',
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

  private async getAuthorizedRequest(
    campaignId: string,
    requestId: string,
    userId: string,
    access: ResolvedCampaignAccess,
  ): Promise<ServiceResult<RequestWithRelations>> {
    const request = await prisma.campaignRequest.findFirst({
      where: {
        id: requestId,
        campaignId,
      },
      select: requestIncludeForViewer(userId),
    })

    if (!request) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Request not found',
      }
    }

    if (
      !isVisibleToAccess(access, userId, {
        createdByUserId: request.createdByUserId,
        visibility: request.visibility,
      })
    ) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Request not found',
      }
    }

    return { ok: true, data: request as RequestWithRelations }
  }

  async createRequest(
    campaignId: string,
    userId: string,
    input: CampaignRequestCreateInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN',
  ): Promise<ServiceResult<CampaignRequestDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const created = await prisma.campaignRequest.create({
      data: {
        campaignId,
        createdByUserId: userId,
        type: input.type,
        visibility: input.visibility,
        title: input.title,
        description: input.description,
      },
      select: requestIncludeForViewer(userId),
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

    return { ok: true, data: toRequestDetail(created as RequestWithRelations, userId, access.data) }
  }

  async listRequests(
    campaignId: string,
    userId: string,
    query: CampaignRequestListQueryInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN',
  ): Promise<ServiceResult<CampaignRequestListResponse>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    if (query.moderationQueue && !hasCampaignDmAccess(access.data)) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'DM access is required for moderation queue',
      }
    }

    const visibilityWhere = hasCampaignDmAccess(access.data)
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
        select: requestIncludeForViewer(userId),
      }),
    ])

    const items = rows.map((row) => toRequestListItem(row as RequestWithRelations, userId, access.data))
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

  async getRequestById(
    campaignId: string,
    requestId: string,
    userId: string,
    systemRole?: 'USER' | 'SYSTEM_ADMIN',
  ): Promise<ServiceResult<CampaignRequestDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const request = await this.getAuthorizedRequest(campaignId, requestId, userId, access.data)
    if (!request.ok) return request

    return {
      ok: true,
      data: toRequestDetail(request.data, userId, access.data),
    }
  }

  async updateRequest(
    campaignId: string,
    requestId: string,
    userId: string,
    input: CampaignRequestUpdateInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN',
  ): Promise<ServiceResult<CampaignRequestDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const existing = await this.getAuthorizedRequest(campaignId, requestId, userId, access.data)
    if (!existing.ok) return existing

    if (!canEditRequest(userId, {
      createdByUserId: existing.data.createdByUserId,
      visibility: existing.data.visibility,
      status: toStatus(existing.data.status),
    })) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only the creator can edit a pending request',
      }
    }

    const updated = await prisma.campaignRequest.update({
      where: { id: existing.data.id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      select: requestIncludeForViewer(userId),
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

    return {
      ok: true,
      data: toRequestDetail(updated as RequestWithRelations, userId, access.data),
    }
  }

  async cancelRequest(
    campaignId: string,
    requestId: string,
    userId: string,
    systemRole?: 'USER' | 'SYSTEM_ADMIN',
  ): Promise<ServiceResult<CampaignRequestDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const existing = await this.getAuthorizedRequest(campaignId, requestId, userId, access.data)
    if (!existing.ok) return existing

    if (!canCancelRequest(userId, {
      createdByUserId: existing.data.createdByUserId,
      visibility: existing.data.visibility,
      status: toStatus(existing.data.status),
    })) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only the creator can cancel a pending request',
      }
    }

    const canceled = await prisma.campaignRequest.update({
      where: { id: existing.data.id },
      data: {
        status: 'CANCELED',
      },
      select: requestIncludeForViewer(userId),
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

    return {
      ok: true,
      data: toRequestDetail(canceled as RequestWithRelations, userId, access.data),
    }
  }

  async addVote(
    campaignId: string,
    requestId: string,
    userId: string,
    systemRole?: 'USER' | 'SYSTEM_ADMIN',
  ): Promise<ServiceResult<CampaignRequestDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const existing = await this.getAuthorizedRequest(campaignId, requestId, userId, access.data)
    if (!existing.ok) return existing

    if (!canVoteOnRequest({
      createdByUserId: existing.data.createdByUserId,
      visibility: existing.data.visibility,
      status: toStatus(existing.data.status),
    })) {
      return {
        ok: false,
        statusCode: 409,
        code: 'INVALID_REQUEST_STATE',
        message: 'Voting is only available for public pending requests',
      }
    }

    const vote = await prisma.campaignRequestVote.findUnique({
      where: {
        campaignRequestId_userId: {
          campaignRequestId: existing.data.id,
          userId,
        },
      },
      select: { id: true },
    })

    if (!vote) {
      await prisma.campaignRequestVote.create({
        data: {
          campaignRequestId: existing.data.id,
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
        targetId: existing.data.id,
        summary: `Added vote for campaign request "${existing.data.title}".`,
      })
    }

    const refreshed = await this.getAuthorizedRequest(campaignId, requestId, userId, access.data)
    if (!refreshed.ok) return refreshed

    return {
      ok: true,
      data: toRequestDetail(refreshed.data, userId, access.data),
    }
  }

  async removeMyVote(
    campaignId: string,
    requestId: string,
    userId: string,
    systemRole?: 'USER' | 'SYSTEM_ADMIN',
  ): Promise<ServiceResult<CampaignRequestDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    const existing = await this.getAuthorizedRequest(campaignId, requestId, userId, access.data)
    if (!existing.ok) return existing

    if (!canVoteOnRequest({
      createdByUserId: existing.data.createdByUserId,
      visibility: existing.data.visibility,
      status: toStatus(existing.data.status),
    })) {
      return {
        ok: false,
        statusCode: 409,
        code: 'INVALID_REQUEST_STATE',
        message: 'Voting is only available for public pending requests',
      }
    }

    const deleted = await prisma.campaignRequestVote.deleteMany({
      where: {
        campaignRequestId: existing.data.id,
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
        targetId: existing.data.id,
        summary: `Removed vote for campaign request "${existing.data.title}".`,
      })
    }

    const refreshed = await this.getAuthorizedRequest(campaignId, requestId, userId, access.data)
    if (!refreshed.ok) return refreshed

    return {
      ok: true,
      data: toRequestDetail(refreshed.data, userId, access.data),
    }
  }

  async decideRequest(
    campaignId: string,
    requestId: string,
    userId: string,
    input: CampaignRequestDecisionInput,
    systemRole?: 'USER' | 'SYSTEM_ADMIN',
  ): Promise<ServiceResult<CampaignRequestDetail>> {
    const access = await this.resolveAccess(campaignId, userId, systemRole)
    if (!access.ok) return access

    if (!hasCampaignDmAccess(access.data)) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'DM access is required to decide requests',
      }
    }

    const existing = await this.getAuthorizedRequest(campaignId, requestId, userId, access.data)
    if (!existing.ok) return existing

    if (!isModeratableByAccess(access.data, toStatus(existing.data.status))) {
      return {
        ok: false,
        statusCode: 409,
        code: 'INVALID_REQUEST_STATE',
        message: 'Only pending requests can be decided',
      }
    }

    const updated = await prisma.campaignRequest.update({
      where: { id: existing.data.id },
      data: {
        status: input.decision,
        decisionNote: input.decisionNote || null,
        decidedByUserId: userId,
        decidedAt: new Date(),
      },
      select: requestIncludeForViewer(userId),
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

    return {
      ok: true,
      data: toRequestDetail(updated as RequestWithRelations, userId, access.data),
    }
  }
}
