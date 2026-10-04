import { createHash, randomBytes } from 'node:crypto'
import type { CampaignRole } from '#server/db/schema'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq, and, lt, asc, desc } from 'drizzle-orm'
import type {
  CampaignInviteCreateInput,
  CampaignMemberUpdateInput,
  CampaignOwnerTransferInput,
} from '#shared/schemas/campaign-membership'
import { ActivityLogService } from '#server/services/activity-log.service'
import { apiError } from '#server/utils/http'

const DEFAULT_INVITE_EXPIRY_DAYS = 7
const activityLogService = new ActivityLogService()

const hashInviteToken = (token: string) => createHash('sha256').update(token).digest('hex')

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const getInviteAcceptUrl = (token: string) => {
  const config = useRuntimeConfig()
  const appUrl = (config.public.appUrl || '').trim()
  const path = `/campaign-invites/${token}`

  if (!appUrl) {
    return path
  }

  return `${appUrl.replace(/\/$/, '')}${path}`
}

type CampaignMemberRow = {
  id: string
  userId: string
  role: CampaignRole
  hasDmAccess: boolean
  createdAt: string
  updatedAt: string
  user: {
    id: string
    email: string
    name: string
    avatarUrl: string | null
  }
}

type CampaignInviteRow = {
  id: string
  email: string
  role: CampaignRole
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
  expiresAt: string
  createdAt: string
  invitedByUser: {
    id: string
    name: string
    email: string
  }
}

export type CampaignInviteInspection =
  | {
      status: 'CAN_ACCEPT'
      role: CampaignRole
      expiresAt: string
    }
  | {
      status: 'ALREADY_MEMBER'
      campaignId: string
      campaignName: string
      role: CampaignRole
      hasDmAccess: boolean
    }
  | {
      status: 'WRONG_ACCOUNT'
    }
  | {
      status: 'INVITE_NOT_FOUND'
    }
  | {
      status: 'INVITE_EXPIRED'
    }
  | {
      status: 'INVITE_ALREADY_PROCESSED'
    }

const toMemberRow = (member: {
  id: string
  userId: string
  role: CampaignRole
  hasDmAccess: boolean
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    email: string
    name: string
    avatarUrl: string | null
  }
}): CampaignMemberRow => ({
  id: member.id,
  userId: member.userId,
  role: member.role,
  hasDmAccess: member.role === 'OWNER' ? true : member.hasDmAccess,
  createdAt: member.createdAt.toISOString(),
  updatedAt: member.updatedAt.toISOString(),
  user: {
    id: member.user.id,
    email: member.user.email,
    name: member.user.name,
    avatarUrl: member.user.avatarUrl,
  },
})

const toInviteRow = (invite: {
  id: string
  email: string
  role: CampaignRole
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
  expiresAt: Date
  createdAt: Date
  invitedByUser: {
    id: string
    name: string
    email: string
  }
}): CampaignInviteRow => ({
  id: invite.id,
  email: invite.email,
  role: invite.role,
  status: invite.status,
  expiresAt: invite.expiresAt.toISOString(),
  createdAt: invite.createdAt.toISOString(),
  invitedByUser: {
    id: invite.invitedByUser.id,
    name: invite.invitedByUser.name,
    email: invite.invitedByUser.email,
  },
})

export class CampaignMembershipService {
  async inspectInvite(
    inviteToken: string,
    userId: string,
    userEmail: string
  ): Promise<CampaignInviteInspection> {
    const tokenHash = hashInviteToken(inviteToken)

    const invite = await db.query.campaignInvite.findFirst({
      where: eq(tables.campaignInvite.tokenHash, tokenHash),
      with: { campaign: { columns: {
            id: true,
            name: true
          } } }
    }).sync()

    if (!invite) {
      return {
          status: 'INVITE_NOT_FOUND',
        }
    }

    const existingMember = await db.query.campaignMember.findFirst({
      where: and(eq(tables.campaignMember.campaignId, invite.campaignId), eq(tables.campaignMember.userId, userId)),
      columns: {
        role: true,
        hasDmAccess: true
      }
    }).sync()

    if (existingMember) {
      return {
          status: 'ALREADY_MEMBER',
          campaignId: invite.campaign.id,
          campaignName: invite.campaign.name,
          role: existingMember.role,
          hasDmAccess: existingMember.role === 'OWNER' ? true : existingMember.hasDmAccess,
        }
    }

    if (invite.status !== 'PENDING') {
      return {
          status: 'INVITE_ALREADY_PROCESSED',
        }
    }

    if (invite.expiresAt < new Date()) {
      await db.update(tables.campaignInvite).set({ status: 'EXPIRED' }).where(eq(tables.campaignInvite.id, invite.id)).returning().get()!

      return {
          status: 'INVITE_EXPIRED',
        }
    }

    if (normalizeEmail(invite.email) !== normalizeEmail(userEmail)) {
      return {
          status: 'WRONG_ACCOUNT',
        }
    }

    return {
        status: 'CAN_ACCEPT',
        role: invite.role,
        expiresAt: invite.expiresAt.toISOString(),
      }
  }

  private async expirePendingInvites(campaignId: string) {
    await db.update(tables.campaignInvite).set({ status: 'EXPIRED' }).where(and(eq(tables.campaignInvite.campaignId, campaignId), eq(tables.campaignInvite.status, 'PENDING'), lt(tables.campaignInvite.expiresAt, new Date()))).run()
  }

  async listMembers(campaignId: string): Promise<{
    campaignId: string
    campaignName: string
    members: CampaignMemberRow[]
    pendingInvites: CampaignInviteRow[]
  }> {
    await this.expirePendingInvites(campaignId)

    const campaign = await db.query.campaign.findFirst({
      where: eq(tables.campaign.id, campaignId),
      columns: {
        id: true,
        name: true
      },
      with: {
        members: {
          orderBy: [asc(tables.campaignMember.role), asc(tables.campaignMember.createdAt)],
          with: { user: { columns: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true
              } } }
        },
        invites: {
          where: eq(tables.campaignInvite.status, 'PENDING'),
          orderBy: [desc(tables.campaignInvite.createdAt)],
          with: { invitedByUser: { columns: {
                id: true,
                name: true,
                email: true
              } } }
        }
      }
    }).sync()

    if (!campaign) {
      throw apiError(404, 'NOT_FOUND', 'Campaign not found')
    }

    return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        members: campaign.members.map(toMemberRow),
        pendingInvites: campaign.invites.map(toInviteRow),
      }
  }

  async createInvite(
    campaignId: string,
    invitedByUserId: string,
    input: CampaignInviteCreateInput
  ): Promise<{
    invite: CampaignInviteRow
    inviteToken: string
    acceptUrl: string
  }> {
    const email = normalizeEmail(input.email)

    const existingUser = await db.query.user.findFirst({
      where: eq(tables.user.email, email),
      columns: { id: true }
    }).sync()

    if (existingUser) {
      const existingMembership = await db.query.campaignMember.findFirst({
        where: and(eq(tables.campaignMember.campaignId, campaignId), eq(tables.campaignMember.userId, existingUser.id)),
        columns: { id: true }
      }).sync()

      if (existingMembership) {
        throw apiError(409, 'MEMBER_ALREADY_EXISTS', 'User is already a campaign member.', {
            email: 'User is already a member',
          })
      }
    }

    await this.expirePendingInvites(campaignId)

    await db.update(tables.campaignInvite).set({ status: 'REVOKED' }).where(and(eq(tables.campaignInvite.campaignId, campaignId), eq(tables.campaignInvite.email, email), eq(tables.campaignInvite.status, 'PENDING'))).run()

    const inviteToken = randomBytes(24).toString('hex')
    const tokenHash = hashInviteToken(inviteToken)
    const expiresInDays = input.expiresInDays || DEFAULT_INVITE_EXPIRY_DAYS
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

    const invite = await (() => { const written = db.insert(tables.campaignInvite).values({
      campaignId,
      email,
      role: input.role,
      tokenHash,
      expiresAt,
      invitedByUserId
    }).returning().get()!; return db.query.campaignInvite.findFirst({
        where: eq(tables.campaignInvite.id, written.id),
        with: { invitedByUser: { columns: {
              id: true,
              name: true,
              email: true
            } } }
      }).sync()! })()

    await activityLogService.log({
      actorUserId: invitedByUserId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'CAMPAIGN_MEMBER_INVITE_CREATED',
      targetType: 'CAMPAIGN_INVITE',
      targetId: invite.id,
      summary: 'Created campaign invite.',
      metadata: {
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt.toISOString(),
      },
    })

    return {
        invite: toInviteRow(invite),
        inviteToken,
        acceptUrl: getInviteAcceptUrl(inviteToken),
      }
  }

  async acceptInvite(
    inviteToken: string,
    userId: string,
    userEmail: string
  ): Promise<{
    campaignId: string
    campaignName: string
    role: CampaignRole
  }> {
    const tokenHash = hashInviteToken(inviteToken)

    const invite = await db.query.campaignInvite.findFirst({
      where: eq(tables.campaignInvite.tokenHash, tokenHash),
      with: { campaign: { columns: {
            id: true,
            name: true
          } } }
    }).sync()

    if (!invite) {
      throw apiError(404, 'INVITE_NOT_FOUND', 'Campaign invite not found.')
    }

    const existingMember = await db.query.campaignMember.findFirst({
      where: and(eq(tables.campaignMember.campaignId, invite.campaignId), eq(tables.campaignMember.userId, userId)),
      columns: { role: true }
    }).sync()

    if (existingMember) {
      return {
          campaignId: invite.campaign.id,
          campaignName: invite.campaign.name,
          role: existingMember.role,
        }
    }

    if (invite.status !== 'PENDING') {
      throw apiError(409, 'INVITE_ALREADY_PROCESSED', 'This invite has already been processed.')
    }

    if (invite.expiresAt < new Date()) {
      await db.update(tables.campaignInvite).set({ status: 'EXPIRED' }).where(eq(tables.campaignInvite.id, invite.id)).returning().get()!

      throw apiError(410, 'INVITE_EXPIRED', 'This invite has expired.')
    }

    if (normalizeEmail(invite.email) !== normalizeEmail(userEmail)) {
      throw apiError(403, 'INVITE_EMAIL_MISMATCH', 'Invite email does not match your signed-in account.')
    }

    const membership = await db.transaction((tx) => {
      const member = tx.insert(tables.campaignMember).values({
        campaignId: invite.campaignId,
        userId,
        role: invite.role,
        hasDmAccess: false,
        invitedByUserId: invite.invitedByUserId
      }).onConflictDoUpdate({
        target: [tables.campaignMember.campaignId, tables.campaignMember.userId],
        set: {
          role: invite.role,
          hasDmAccess: false
        }
      }).returning().get()!;
      tx.update(tables.campaignInvite).set({
        status: 'ACCEPTED',
        acceptedByUserId: userId
      }).where(eq(tables.campaignInvite.id, invite.id)).returning().get()!;
      return member;
    }, { behavior: 'immediate' })

    await activityLogService.log({
      actorUserId: userId,
      campaignId: invite.campaignId,
      scope: 'CAMPAIGN',
      action: 'CAMPAIGN_MEMBER_INVITE_ACCEPTED',
      targetType: 'CAMPAIGN_INVITE',
      targetId: invite.id,
      summary: 'Accepted campaign invite.',
      metadata: {
        acceptedByUserId: userId,
        role: membership.role,
      },
    })

    return {
        campaignId: invite.campaign.id,
        campaignName: invite.campaign.name,
        role: membership.role,
      }
  }

  async updateMember(
    campaignId: string,
    memberId: string,
    actorUserId: string,
    input: CampaignMemberUpdateInput
  ): Promise<CampaignMemberRow> {
    const member = await db.query.campaignMember.findFirst({
      where: and(eq(tables.campaignMember.id, memberId), eq(tables.campaignMember.campaignId, campaignId)),
      with: { user: { columns: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true
          } } }
    }).sync()

    if (!member) {
      throw apiError(404, 'MEMBER_NOT_FOUND', 'Campaign member not found.')
    }

    if (member.role === 'OWNER') {
      throw apiError(409, 'OWNER_ROLE_CHANGE_FORBIDDEN', 'Use owner transfer to change owner role.')
    }

    if (member.userId === actorUserId) {
      throw apiError(400, 'SELF_ROLE_CHANGE_FORBIDDEN', 'You cannot change your own campaign role here.')
    }

    const updateData: {
      role?: CampaignRole
      hasDmAccess?: boolean
    } = {}

    if (input.role !== undefined) {
      updateData.role = input.role
    }
    if (input.hasDmAccess !== undefined) {
      updateData.hasDmAccess = input.hasDmAccess
    }

    const updated = await (() => { const written = db.update(tables.campaignMember).set(updateData).where(eq(tables.campaignMember.id, member.id)).returning().get()!; return db.query.campaignMember.findFirst({
      where: eq(tables.campaignMember.id, written.id),
      with: { user: { columns: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true
          } } }
    }).sync()! })()

    await activityLogService.log({
      actorUserId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'CAMPAIGN_MEMBER_ROLE_UPDATED',
      targetType: 'CAMPAIGN_MEMBER',
      targetId: member.id,
      summary: 'Updated campaign member settings.',
      metadata: {
        memberUserId: member.userId,
        previousRole: member.role,
        nextRole: updated.role,
        previousHasDmAccess: member.hasDmAccess,
        nextHasDmAccess: updated.hasDmAccess,
      },
    })

    return toMemberRow(updated)
  }

  async removeMember(
    campaignId: string,
    memberId: string,
    actorUserId: string
  ): Promise<{ removedMemberId: string }> {
    const member = await db.query.campaignMember.findFirst({
      where: and(eq(tables.campaignMember.id, memberId), eq(tables.campaignMember.campaignId, campaignId)),
      columns: {
        id: true,
        role: true,
        userId: true
      }
    }).sync()

    if (!member) {
      throw apiError(404, 'MEMBER_NOT_FOUND', 'Campaign member not found.')
    }

    if (member.role === 'OWNER') {
      throw apiError(409, 'OWNER_REMOVE_FORBIDDEN', 'Owner cannot be removed. Transfer ownership first.')
    }

    if (member.userId === actorUserId) {
      throw apiError(400, 'SELF_REMOVE_FORBIDDEN', 'You cannot remove your own membership from this endpoint.')
    }

    await db.delete(tables.campaignMember).where(eq(tables.campaignMember.id, member.id)).returning().get()!

    await activityLogService.log({
      actorUserId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'CAMPAIGN_MEMBER_REMOVED',
      targetType: 'CAMPAIGN_MEMBER',
      targetId: member.id,
      summary: 'Removed campaign member.',
      metadata: {
        memberUserId: member.userId,
        removedRole: member.role,
      },
    })

    return {
        removedMemberId: member.id,
      }
  }

  async transferOwnership(
    campaignId: string,
    ownerUserId: string,
    input: CampaignOwnerTransferInput
  ): Promise<{
    campaignId: string
    newOwnerUserId: string
    previousOwnerUserId: string
    newOwnerMemberId: string
  }> {
    const owner = await db.query.user.findFirst({
      where: eq(tables.user.id, ownerUserId),
      columns: { passwordHash: true }
    }).sync()

    if (!owner?.passwordHash) {
      throw apiError(400, 'PASSWORD_REQUIRED', 'Password login is not configured for this account.')
    }

    const passwordValid = await verifyPassword(owner.passwordHash, input.password)
    if (!passwordValid) {
      throw apiError(401, 'INVALID_CREDENTIALS', 'Invalid password.', {
          password: 'Password is incorrect',
        })
    }

    const targetMember = await db.query.campaignMember.findFirst({
      where: and(eq(tables.campaignMember.id, input.targetMemberId), eq(tables.campaignMember.campaignId, campaignId)),
      columns: {
        id: true,
        userId: true,
        role: true
      }
    }).sync()

    if (!targetMember) {
      throw apiError(404, 'MEMBER_NOT_FOUND', 'Target member was not found for this campaign.')
    }

    if (targetMember.userId === ownerUserId) {
      throw apiError(400, 'OWNER_TRANSFER_INVALID_TARGET', 'Select a different member to transfer ownership.')
    }

    const transferResult = await db.transaction((tx) => {
      tx.update(tables.campaign).set({ ownerId: targetMember.userId }).where(eq(tables.campaign.id, campaignId)).returning().get()!;
      tx.insert(tables.campaignMember).values({
        campaignId,
        userId: ownerUserId,
        role: 'COLLABORATOR',
        hasDmAccess: false,
        invitedByUserId: ownerUserId
      }).onConflictDoUpdate({
        target: [tables.campaignMember.campaignId, tables.campaignMember.userId],
        set: { role: 'COLLABORATOR' }
      }).returning().get()!;
      const updatedOwnerMember = tx.update(tables.campaignMember).set({
        role: 'OWNER',
        hasDmAccess: true
      }).where(eq(tables.campaignMember.id, targetMember.id)).returning({
        id: tables.campaignMember.id,
        userId: tables.campaignMember.userId
      }).get()!;
      return updatedOwnerMember;
    }, { behavior: 'immediate' })

    await activityLogService.log({
      actorUserId: ownerUserId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'CAMPAIGN_OWNER_TRANSFERRED',
      targetType: 'CAMPAIGN',
      targetId: campaignId,
      summary: 'Transferred campaign ownership.',
      metadata: {
        previousOwnerUserId: ownerUserId,
        newOwnerUserId: transferResult.userId,
        newOwnerMemberId: transferResult.id,
      },
    })

    return {
        campaignId,
        newOwnerUserId: transferResult.userId,
        previousOwnerUserId: ownerUserId,
        newOwnerMemberId: transferResult.id,
      }
  }
}

