import { prisma } from '#server/db/prisma'
import type { ServiceResult } from '#server/services/auth.service'
import type {
  AdminActivityLogListQuery,
  AdminCampaignListQuery,
  AdminCampaignUpdateInput,
  AdminUserListQuery,
  AdminUserUpdateInput,
} from '#shared/schemas/admin'
import { AdminAuditService } from '#server/services/admin-audit.service'
import { ActivityLogService } from '#server/services/activity-log.service'

const auditService = new AdminAuditService()
const activityLogService = new ActivityLogService()

const normalizeSearch = (value?: string) => {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

const toDateRange = (from?: string, to?: string) => {
  if (!from && !to) {
    return undefined
  }

  const start = from ? new Date(`${from}T00:00:00.000Z`) : undefined
  const end = to ? new Date(`${to}T23:59:59.999Z`) : undefined

  return {
    ...(start ? { gte: start } : {}),
    ...(end ? { lte: end } : {}),
  }
}

const getPagination = (page: number, pageSize: number) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
})

export class AdminService {
  async listUsers(query: AdminUserListQuery) {
    const search = normalizeSearch(query.search)

    const where = {
      ...(search
        ? {
            OR: [
              { email: { contains: search } },
              { name: { contains: search } },
            ],
          }
        : {}),
      ...(query.status === 'active' ? { isActive: true } : {}),
      ...(query.status === 'inactive' ? { isActive: false } : {}),
      ...(query.role !== 'all' ? { systemRole: query.role } : {}),
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        ...getPagination(query.page, query.pageSize),
        select: {
          id: true,
          email: true,
          name: true,
          systemRole: true,
          isActive: true,
          avatarUrl: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              campaigns: true,
              campaignMemberships: true,
            },
          },
        },
      }),
    ])

    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        systemRole: user.systemRole,
        isActive: user.isActive,
        avatarUrl: user.avatarUrl,
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        ownedCampaignCount: user._count.campaigns,
        memberCampaignCount: user._count.campaignMemberships,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }

  async getUser(userId: string): Promise<ServiceResult<{
    id: string
    email: string
    name: string
    systemRole: 'USER' | 'SYSTEM_ADMIN'
    isActive: boolean
    avatarUrl: string | null
    lastLoginAt: string | null
    createdAt: string
    updatedAt: string
    ownedCampaignCount: number
    memberCampaignCount: number
    recentOwnedCampaigns: Array<{
      id: string
      name: string
      isArchived: boolean
      updatedAt: string
    }>
  }>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        systemRole: true,
        isActive: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            campaigns: true,
            campaignMemberships: true,
          },
        },
        campaigns: {
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            isArchived: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!user) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'User not found',
      }
    }

    return {
      ok: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        systemRole: user.systemRole,
        isActive: user.isActive,
        avatarUrl: user.avatarUrl,
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        ownedCampaignCount: user._count.campaigns,
        memberCampaignCount: user._count.campaignMemberships,
        recentOwnedCampaigns: user.campaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          isArchived: campaign.isArchived,
          updatedAt: campaign.updatedAt.toISOString(),
        })),
      },
    }
  }

  async updateUser(
    userId: string,
    actorUserId: string,
    input: AdminUserUpdateInput
  ): Promise<ServiceResult<{
    id: string
    systemRole: 'USER' | 'SYSTEM_ADMIN'
    isActive: boolean
    updatedAt: string
  }>> {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        systemRole: true,
        isActive: true,
      },
    })

    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'User not found',
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.systemRole !== undefined ? { systemRole: input.systemRole } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: {
        id: true,
        systemRole: true,
        isActive: true,
        updatedAt: true,
      },
    })

    await auditService.log({
      actorUserId,
      action: 'ADMIN_USER_UPDATE',
      targetType: 'USER',
      targetId: userId,
      summary: 'Updated user role or active status',
      metadata: {
        before: existing,
        after: {
          systemRole: updated.systemRole,
          isActive: updated.isActive,
        },
      },
    })
    await activityLogService.log({
      actorUserId,
      scope: 'ADMIN',
      action: 'ADMIN_USER_UPDATE',
      targetType: 'USER',
      targetId: userId,
      summary: 'Updated user role or active status',
      metadata: {
        before: existing,
        after: {
          systemRole: updated.systemRole,
          isActive: updated.isActive,
        },
      },
    })

    return {
      ok: true,
      data: {
        id: updated.id,
        systemRole: updated.systemRole,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt.toISOString(),
      },
    }
  }

  async listCampaigns(query: AdminCampaignListQuery) {
    const search = normalizeSearch(query.search)

    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : {}),
      ...(query.archived === 'active' ? { isArchived: false } : {}),
      ...(query.archived === 'archived' ? { isArchived: true } : {}),
    }

    const [total, campaigns] = await Promise.all([
      prisma.campaign.count({ where }),
      prisma.campaign.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        ...getPagination(query.page, query.pageSize),
        select: {
          id: true,
          name: true,
          system: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          _count: {
            select: {
              members: true,
              sessions: true,
              glossary: true,
              quests: true,
              milestones: true,
              documents: true,
            },
          },
        },
      }),
    ])

    return {
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        system: campaign.system,
        isArchived: campaign.isArchived,
        owner: campaign.owner,
        memberCount: Math.max(1, campaign._count.members),
        sessionCount: campaign._count.sessions,
        glossaryCount: campaign._count.glossary,
        questCount: campaign._count.quests,
        milestoneCount: campaign._count.milestones,
        documentCount: campaign._count.documents,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }

  async listActivityLogs(query: AdminActivityLogListQuery) {
    const search = normalizeSearch(query.search)
    const dateRange = toDateRange(query.from, query.to)

    const where = {
      ...(query.scope !== 'all' ? { scope: query.scope } : {}),
      ...(query.action ? { action: query.action.trim() } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
      ...(dateRange ? { createdAt: dateRange } : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search } },
              { summary: { contains: search } },
              { targetType: { contains: search } },
              { targetId: { contains: search } },
              { actorUser: { email: { contains: search } } },
              { actorUser: { name: { contains: search } } },
              { campaign: { name: { contains: search } } },
            ],
          }
        : {}),
    }

    const [total, rows] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        ...getPagination(query.page, query.pageSize),
        select: {
          id: true,
          scope: true,
          action: true,
          targetType: true,
          targetId: true,
          summary: true,
          metadata: true,
          createdAt: true,
          actorUserId: true,
          actorUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          campaignId: true,
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ])

    return {
      logs: rows.map((row) => ({
        id: row.id,
        scope: row.scope as 'CAMPAIGN' | 'ADMIN' | 'SYSTEM',
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        summary: row.summary,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
        actorUserId: row.actorUserId,
        actorUser: row.actorUser
          ? {
              id: row.actorUser.id,
              email: row.actorUser.email,
              name: row.actorUser.name,
            }
          : null,
        campaignId: row.campaignId,
        campaign: row.campaign
          ? {
              id: row.campaign.id,
              name: row.campaign.name,
            }
          : null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }

  async getCampaign(campaignId: string): Promise<ServiceResult<{
    id: string
    name: string
    description: string | null
    system: string
    isArchived: boolean
    owner: {
      id: string
      email: string
      name: string
    }
    createdAt: string
    updatedAt: string
    counts: {
      members: number
      sessions: number
      glossary: number
      quests: number
      milestones: number
      recordings: number
      documents: number
    }
    recentMembers: Array<{
      id: string
      userId: string
      role: 'OWNER' | 'COLLABORATOR' | 'VIEWER'
      joinedAt: string
      user: {
        email: string
        name: string
      }
    }>
  }>> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        description: true,
        system: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        _count: {
          select: {
            members: true,
            sessions: true,
            glossary: true,
            quests: true,
            milestones: true,
            documents: true,
          },
        },
        sessions: {
          select: {
            _count: {
              select: { recordings: true },
            },
          },
        },
        members: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            userId: true,
            role: true,
            createdAt: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!campaign) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Campaign not found',
      }
    }

    const recordings = campaign.sessions.reduce((total, session) => total + session._count.recordings, 0)

    return {
      ok: true,
      data: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        system: campaign.system,
        isArchived: campaign.isArchived,
        owner: campaign.owner,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
        counts: {
          members: Math.max(1, campaign._count.members),
          sessions: campaign._count.sessions,
          glossary: campaign._count.glossary,
          quests: campaign._count.quests,
          milestones: campaign._count.milestones,
          recordings,
          documents: campaign._count.documents,
        },
        recentMembers: campaign.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          joinedAt: member.createdAt.toISOString(),
          user: member.user,
        })),
      },
    }
  }

  async updateCampaign(
    campaignId: string,
    actorUserId: string,
    input: AdminCampaignUpdateInput
  ): Promise<ServiceResult<{
    id: string
    ownerId: string
    isArchived: boolean
    updatedAt: string
  }>> {
    const existing = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        ownerId: true,
        isArchived: true,
      },
    })

    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Campaign not found',
      }
    }

    if (input.transferOwnerUserId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: input.transferOwnerUserId },
        select: { id: true, isActive: true },
      })

      if (!targetUser) {
        return {
          ok: false,
          statusCode: 404,
          code: 'TARGET_USER_NOT_FOUND',
          message: 'Target owner user was not found.',
        }
      }

      if (!targetUser.isActive) {
        return {
          ok: false,
          statusCode: 409,
          code: 'TARGET_USER_INACTIVE',
          message: 'Target owner must be active.',
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.transferOwnerUserId && input.transferOwnerUserId !== existing.ownerId) {
        await tx.campaignMember.upsert({
          where: {
            campaignId_userId: {
              campaignId,
              userId: existing.ownerId,
            },
          },
          update: {
            role: 'COLLABORATOR',
          },
          create: {
            campaignId,
            userId: existing.ownerId,
            role: 'COLLABORATOR',
            invitedByUserId: actorUserId,
          },
        })

        await tx.campaignMember.upsert({
          where: {
            campaignId_userId: {
              campaignId,
              userId: input.transferOwnerUserId,
            },
          },
          update: {
            role: 'OWNER',
          },
          create: {
            campaignId,
            userId: input.transferOwnerUserId,
            role: 'OWNER',
            invitedByUserId: actorUserId,
          },
        })
      }

      return tx.campaign.update({
        where: { id: campaignId },
        data: {
          ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
          ...(input.transferOwnerUserId ? { ownerId: input.transferOwnerUserId } : {}),
        },
        select: {
          id: true,
          ownerId: true,
          isArchived: true,
          updatedAt: true,
        },
      })
    })

    await auditService.log({
      actorUserId,
      action: 'ADMIN_CAMPAIGN_UPDATE',
      targetType: 'CAMPAIGN',
      targetId: campaignId,
      summary: 'Updated campaign archive status or owner',
      metadata: {
        before: existing,
        after: {
          ownerId: updated.ownerId,
          isArchived: updated.isArchived,
        },
      },
    })
    await activityLogService.log({
      actorUserId,
      campaignId,
      scope: 'ADMIN',
      action: 'ADMIN_CAMPAIGN_UPDATE',
      targetType: 'CAMPAIGN',
      targetId: campaignId,
      summary: 'Updated campaign archive status or owner',
      metadata: {
        before: existing,
        after: {
          ownerId: updated.ownerId,
          isArchived: updated.isArchived,
        },
      },
    })

    return {
      ok: true,
      data: {
        id: updated.id,
        ownerId: updated.ownerId,
        isArchived: updated.isArchived,
        updatedAt: updated.updatedAt.toISOString(),
      },
    }
  }
}
