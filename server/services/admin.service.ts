import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq, and, or, inArray, lte, gte, like, desc, sql, count } from 'drizzle-orm'
import type {
  AdminActivityLogListQuery,
  AdminCampaignListQuery,
  AdminStorageAuditFixInput,
  AdminStorageAuditQuery,
  AdminCampaignUpdateInput,
  AdminUserListQuery,
  AdminUserUpdateInput,
} from '#shared/schemas/admin'
import { AdminAuditService } from '#server/services/admin-audit.service'
import { ActivityLogService } from '#server/services/activity-log.service'
import { AdminStorageAuditService } from '#server/services/admin-storage-audit.service'
import { apiError } from '#server/utils/http'

const auditService = new AdminAuditService()
const activityLogService = new ActivityLogService()
const storageAuditService = new AdminStorageAuditService()

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
  offset: (page - 1) * pageSize,
  limit: pageSize,
})

export class AdminService {
  async getStorageAudit(query: AdminStorageAuditQuery) {
    return storageAuditService.runAudit(query)
  }

  async applyStorageAuditFix(
    actorUserId: string,
    input: AdminStorageAuditFixInput
  ): Promise<{
    action: AdminStorageAuditFixInput['action']
    targetId: string
    message: string
  }> {
    const result = await storageAuditService.applyFix(input)

    await auditService.log({
      actorUserId,
      action: 'ADMIN_STORAGE_AUDIT_FIX_APPLIED',
      targetType: 'STORAGE_AUDIT',
      targetId: result.targetId,
      summary: result.message,
      metadata: {
        action: result.action,
        targetId: result.targetId,
      },
    })

    await activityLogService.log({
      actorUserId,
      scope: 'ADMIN',
      action: 'ADMIN_STORAGE_AUDIT_FIX_APPLIED',
      targetType: 'STORAGE_AUDIT',
      targetId: result.targetId,
      summary: result.message,
      metadata: {
        action: result.action,
        targetId: result.targetId,
      },
    })

    return result
  }

  async listUsers(query: AdminUserListQuery) {
    const search = normalizeSearch(query.search)

    const where = and(
      search ? or(like(tables.user.email, `%${search}%`), like(tables.user.name, `%${search}%`)) : undefined,
      query.status === 'active' ? eq(tables.user.isActive, true) : undefined,
      query.status === 'inactive' ? eq(tables.user.isActive, false) : undefined,
      query.role !== 'all' ? eq(tables.user.systemRole, query.role) : undefined
    )

    const [total, users] = await Promise.all([
      db.select({ count: count() }).from(tables.user).where(where).get()!.count,
      db.query.user.findMany({
        where, ...getPagination(query.page, query.pageSize),
        orderBy: [desc(tables.user.createdAt)],
        extras: { campaignsCount: sql<number>`(select count(*) from "Campaign" where "Campaign"."ownerId" = ${sql.raw('"user"."id"')})`.mapWith(Number).as('campaigns_count'),
          campaignMembershipsCount: sql<number>`(select count(*) from "CampaignMember" where "CampaignMember"."userId" = ${sql.raw('"user"."id"')})`.mapWith(Number).as('campaignMemberships_count') },
        columns: {
          id: true,
          email: true,
          name: true,
          systemRole: true,
          isActive: true,
          avatarUrl: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true
        }
      }).sync(),
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
        ownedCampaignCount: user.campaignsCount,
        memberCampaignCount: user.campaignMembershipsCount,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }

  async getUser(userId: string): Promise<{
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
  }> {
    const user = await db.query.user.findFirst({
      where: eq(tables.user.id, userId),
      extras: { campaignsCount: sql<number>`(select count(*) from "Campaign" where "Campaign"."ownerId" = ${sql.raw('"user"."id"')})`.mapWith(Number).as('campaigns_count'),
          campaignMembershipsCount: sql<number>`(select count(*) from "CampaignMember" where "CampaignMember"."userId" = ${sql.raw('"user"."id"')})`.mapWith(Number).as('campaignMemberships_count') },
      columns: {
        id: true,
        email: true,
        name: true,
        systemRole: true,
        isActive: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true
      },
      with: { campaigns: {
          orderBy: [desc(tables.campaign.updatedAt)],
          limit: 5,
          columns: {
            id: true,
            name: true,
            isArchived: true,
            updatedAt: true
          }
        } }
    }).sync()

    if (!user) {
      throw apiError(404, 'NOT_FOUND', 'User not found')
    }

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        systemRole: user.systemRole,
        isActive: user.isActive,
        avatarUrl: user.avatarUrl,
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        ownedCampaignCount: user.campaignsCount,
        memberCampaignCount: user.campaignMembershipsCount,
        recentOwnedCampaigns: user.campaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          isArchived: campaign.isArchived,
          updatedAt: campaign.updatedAt.toISOString(),
        })),
      }
  }

  async updateUser(
    userId: string,
    actorUserId: string,
    input: AdminUserUpdateInput
  ): Promise<{
    id: string
    systemRole: 'USER' | 'SYSTEM_ADMIN'
    isActive: boolean
    updatedAt: string
  }> {
    const existing = await db.query.user.findFirst({
      where: eq(tables.user.id, userId),
      columns: {
        id: true,
        systemRole: true,
        isActive: true
      }
    }).sync()

    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'User not found')
    }

    const updated = await db.update(tables.user).set({
      ...(input.systemRole !== undefined ? { systemRole: input.systemRole } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
    }).where(eq(tables.user.id, userId)).returning({
      id: tables.user.id,
      systemRole: tables.user.systemRole,
      isActive: tables.user.isActive,
      updatedAt: tables.user.updatedAt
    }).get()!

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
        id: updated.id,
        systemRole: updated.systemRole,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt.toISOString(),
      }
  }

  async listCampaigns(query: AdminCampaignListQuery) {
    const search = normalizeSearch(query.search)

    const where = and(
      search ? or(like(tables.campaign.name, `%${search}%`), like(tables.campaign.description, `%${search}%`)) : undefined,
      query.archived === 'active' ? eq(tables.campaign.isArchived, false) : undefined,
      query.archived === 'archived' ? eq(tables.campaign.isArchived, true) : undefined
    )

    const [total, campaigns] = await Promise.all([
      db.select({ count: count() }).from(tables.campaign).where(where).get()!.count,
      db.query.campaign.findMany({
        where, ...getPagination(query.page, query.pageSize),
        orderBy: [desc(tables.campaign.updatedAt)],
        extras: { membersCount: sql<number>`(select count(*) from "CampaignMember" where "CampaignMember"."campaignId" = ${sql.raw('"campaign"."id"')})`.mapWith(Number).as('members_count'),
          sessionsCount: sql<number>`(select count(*) from "Session" where "Session"."campaignId" = ${sql.raw('"campaign"."id"')})`.mapWith(Number).as('sessions_count'),
          glossaryCount: sql<number>`(select count(*) from "GlossaryEntry" where "GlossaryEntry"."campaignId" = ${sql.raw('"campaign"."id"')})`.mapWith(Number).as('glossary_count'),
          questsCount: sql<number>`(select count(*) from "Quest" where "Quest"."campaignId" = ${sql.raw('"campaign"."id"')})`.mapWith(Number).as('quests_count'),
          milestonesCount: sql<number>`(select count(*) from "Milestone" where "Milestone"."campaignId" = ${sql.raw('"campaign"."id"')})`.mapWith(Number).as('milestones_count'),
          documentsCount: sql<number>`(select count(*) from "Document" where "Document"."campaignId" = ${sql.raw('"campaign"."id"')})`.mapWith(Number).as('documents_count') },
        columns: {
          id: true,
          name: true,
          system: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true
        },
        with: { owner: { columns: {
              id: true,
              email: true,
              name: true
            } } }
      }).sync(),
    ])

    return {
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        system: campaign.system,
        isArchived: campaign.isArchived,
        owner: campaign.owner,
        memberCount: Math.max(1, campaign.membersCount),
        sessionCount: campaign.sessionsCount,
        glossaryCount: campaign.glossaryCount,
        questCount: campaign.questsCount,
        milestoneCount: campaign.milestonesCount,
        documentCount: campaign.documentsCount,
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

    const where = and(
      query.scope !== 'all' ? eq(tables.activityLog.scope, query.scope) : undefined,
      query.action ? eq(tables.activityLog.action, query.action.trim()) : undefined,
      query.actorUserId ? eq(tables.activityLog.actorUserId, query.actorUserId) : undefined,
      query.campaignId ? eq(tables.activityLog.campaignId, query.campaignId) : undefined,
      dateRange?.gte ? gte(tables.activityLog.createdAt, dateRange.gte) : undefined,
      dateRange?.lte ? lte(tables.activityLog.createdAt, dateRange.lte) : undefined,
      search ? or(
        like(tables.activityLog.action, `%${search}%`), like(tables.activityLog.summary, `%${search}%`),
        like(tables.activityLog.targetType, `%${search}%`), like(tables.activityLog.targetId, `%${search}%`),
        inArray(tables.activityLog.actorUserId, db.select({ id: tables.user.id }).from(tables.user).where(or(like(tables.user.email, `%${search}%`), like(tables.user.name, `%${search}%`)))),
        inArray(tables.activityLog.campaignId, db.select({ id: tables.campaign.id }).from(tables.campaign).where(like(tables.campaign.name, `%${search}%`)))
      ) : undefined
    )

    const [total, rows] = await Promise.all([
      db.select({ count: count() }).from(tables.activityLog).where(where).get()!.count,
      db.query.activityLog.findMany({
        where, ...getPagination(query.page, query.pageSize),
        orderBy: [desc(tables.activityLog.createdAt)],
        columns: {
          id: true,
          scope: true,
          action: true,
          targetType: true,
          targetId: true,
          summary: true,
          metadata: true,
          createdAt: true,
          actorUserId: true,
          campaignId: true
        },
        with: {
          actorUser: { columns: {
              id: true,
              email: true,
              name: true
            } },
          campaign: { columns: {
              id: true,
              name: true
            } }
        }
      }).sync(),
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

  async getCampaign(campaignId: string): Promise<{
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
  }> {
    const campaign = await db.query.campaign.findFirst({
      where: eq(tables.campaign.id, campaignId),
      extras: { membersCount: sql<number>`(select count(*) from "CampaignMember" where "CampaignMember"."campaignId" = ${sql.raw('"campaign"."id"')})`.mapWith(Number).as('members_count'),
          sessionsCount: sql<number>`(select count(*) from "Session" where "Session"."campaignId" = ${sql.raw('"campaign"."id"')})`.mapWith(Number).as('sessions_count'),
          glossaryCount: sql<number>`(select count(*) from "GlossaryEntry" where "GlossaryEntry"."campaignId" = ${sql.raw('"campaign"."id"')})`.mapWith(Number).as('glossary_count'),
          questsCount: sql<number>`(select count(*) from "Quest" where "Quest"."campaignId" = ${sql.raw('"campaign"."id"')})`.mapWith(Number).as('quests_count'),
          milestonesCount: sql<number>`(select count(*) from "Milestone" where "Milestone"."campaignId" = ${sql.raw('"campaign"."id"')})`.mapWith(Number).as('milestones_count'),
          documentsCount: sql<number>`(select count(*) from "Document" where "Document"."campaignId" = ${sql.raw('"campaign"."id"')})`.mapWith(Number).as('documents_count') },
      columns: {
        id: true,
        name: true,
        description: true,
        system: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true
      },
      with: {
        owner: { columns: {
            id: true,
            email: true,
            name: true
          } },
        sessions: {
          extras: { recordingsCount: sql<number>`(select count(*) from "Recording" where "Recording"."sessionId" = ${tables.session.id})`.mapWith(Number).as('recordings_count') },
          columns: {}
        },
        members: {
          orderBy: [desc(tables.campaignMember.createdAt)],
          limit: 10,
          columns: {
            id: true,
            userId: true,
            role: true,
            createdAt: true
          },
          with: { user: { columns: {
                email: true,
                name: true
              } } }
        }
      }
    }).sync()

    if (!campaign) {
      throw apiError(404, 'NOT_FOUND', 'Campaign not found')
    }

    const recordings = campaign.sessions.reduce((total, session) => total + session.recordingsCount, 0)

    return {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        system: campaign.system,
        isArchived: campaign.isArchived,
        owner: campaign.owner,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
        counts: {
          members: Math.max(1, campaign.membersCount),
          sessions: campaign.sessionsCount,
          glossary: campaign.glossaryCount,
          quests: campaign.questsCount,
          milestones: campaign.milestonesCount,
          recordings,
          documents: campaign.documentsCount,
        },
        recentMembers: campaign.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          joinedAt: member.createdAt.toISOString(),
          user: member.user,
        })),
      }
  }

  async updateCampaign(
    campaignId: string,
    actorUserId: string,
    input: AdminCampaignUpdateInput
  ): Promise<{
    id: string
    ownerId: string
    isArchived: boolean
    updatedAt: string
  }> {
    const existing = await db.query.campaign.findFirst({
      where: eq(tables.campaign.id, campaignId),
      columns: {
        id: true,
        ownerId: true,
        isArchived: true
      }
    }).sync()

    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Campaign not found')
    }

    if (input.transferOwnerUserId) {
      const targetUser = await db.query.user.findFirst({
        where: eq(tables.user.id, input.transferOwnerUserId),
        columns: {
          id: true,
          isActive: true
        }
      }).sync()

      if (!targetUser) {
        throw apiError(404, 'TARGET_USER_NOT_FOUND', 'Target owner user was not found.')
      }

      if (!targetUser.isActive) {
        throw apiError(409, 'TARGET_USER_INACTIVE', 'Target owner must be active.')
      }
    }

    const updated = await db.transaction((tx) => {
      if (input.transferOwnerUserId && input.transferOwnerUserId !== existing.ownerId) {
        tx.insert(tables.campaignMember).values({
          campaignId,
          userId: existing.ownerId,
          role: 'COLLABORATOR',
          invitedByUserId: actorUserId
        }).onConflictDoUpdate({
          target: [tables.campaignMember.campaignId, tables.campaignMember.userId],
          set: { role: 'COLLABORATOR' }
        }).returning().get()!;
        tx.insert(tables.campaignMember).values({
          campaignId,
          userId: input.transferOwnerUserId,
          role: 'OWNER',
          invitedByUserId: actorUserId
        }).onConflictDoUpdate({
          target: [tables.campaignMember.campaignId, tables.campaignMember.userId],
          set: { role: 'OWNER' }
        }).returning().get()!;
      }
      return tx.update(tables.campaign).set({
        ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
        ...(input.transferOwnerUserId ? { ownerId: input.transferOwnerUserId } : {})
      }).where(eq(tables.campaign.id, campaignId)).returning({
        id: tables.campaign.id,
        ownerId: tables.campaign.ownerId,
        isArchived: tables.campaign.isArchived,
        updatedAt: tables.campaign.updatedAt
      }).get()!;
    }, { behavior: 'immediate' })

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
        id: updated.id,
        ownerId: updated.ownerId,
        isArchived: updated.isArchived,
        updatedAt: updated.updatedAt.toISOString(),
      }
  }
}
