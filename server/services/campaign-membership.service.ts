import { createHash, randomBytes } from 'node:crypto'
import type { CampaignRole } from '@prisma/client'
import { prisma } from '#server/db/prisma'
import type { ServiceResult } from '#server/services/auth.service'
import type {
  CampaignInviteCreateInput,
  CampaignMemberRoleUpdateInput,
  CampaignOwnerTransferInput,
} from '#shared/schemas/campaign-membership'
import { ActivityLogService } from '#server/services/activity-log.service'

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
  ): Promise<ServiceResult<CampaignInviteInspection>> {
    const tokenHash = hashInviteToken(inviteToken)

    const invite = await prisma.campaignInvite.findUnique({
      where: { tokenHash },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!invite) {
      return {
        ok: true,
        data: {
          status: 'INVITE_NOT_FOUND',
        },
      }
    }

    const existingMember = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId: invite.campaignId,
          userId,
        },
      },
      select: {
        role: true,
      },
    })

    if (existingMember) {
      return {
        ok: true,
        data: {
          status: 'ALREADY_MEMBER',
          campaignId: invite.campaign.id,
          campaignName: invite.campaign.name,
          role: existingMember.role,
        },
      }
    }

    if (invite.status !== 'PENDING') {
      return {
        ok: true,
        data: {
          status: 'INVITE_ALREADY_PROCESSED',
        },
      }
    }

    if (invite.expiresAt < new Date()) {
      await prisma.campaignInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      })

      return {
        ok: true,
        data: {
          status: 'INVITE_EXPIRED',
        },
      }
    }

    if (normalizeEmail(invite.email) !== normalizeEmail(userEmail)) {
      return {
        ok: true,
        data: {
          status: 'WRONG_ACCOUNT',
        },
      }
    }

    return {
      ok: true,
      data: {
        status: 'CAN_ACCEPT',
        role: invite.role,
        expiresAt: invite.expiresAt.toISOString(),
      },
    }
  }

  private async expirePendingInvites(campaignId: string) {
    await prisma.campaignInvite.updateMany({
      where: {
        campaignId,
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    })
  }

  async listMembers(campaignId: string): Promise<ServiceResult<{
    campaignId: string
    campaignName: string
    members: CampaignMemberRow[]
    pendingInvites: CampaignInviteRow[]
  }>> {
    await this.expirePendingInvites(campaignId)

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: [
            { role: 'asc' },
            { createdAt: 'asc' },
          ],
        },
        invites: {
          where: { status: 'PENDING' },
          include: {
            invitedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
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

    return {
      ok: true,
      data: {
        campaignId: campaign.id,
        campaignName: campaign.name,
        members: campaign.members.map(toMemberRow),
        pendingInvites: campaign.invites.map(toInviteRow),
      },
    }
  }

  async createInvite(
    campaignId: string,
    invitedByUserId: string,
    input: CampaignInviteCreateInput
  ): Promise<ServiceResult<{
    invite: CampaignInviteRow
    inviteToken: string
    acceptUrl: string
  }>> {
    const email = normalizeEmail(input.email)

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) {
      const existingMembership = await prisma.campaignMember.findUnique({
        where: {
          campaignId_userId: {
            campaignId,
            userId: existingUser.id,
          },
        },
        select: { id: true },
      })

      if (existingMembership) {
        return {
          ok: false,
          statusCode: 409,
          code: 'MEMBER_ALREADY_EXISTS',
          message: 'User is already a campaign member.',
          fields: {
            email: 'User is already a member',
          },
        }
      }
    }

    await this.expirePendingInvites(campaignId)

    await prisma.campaignInvite.updateMany({
      where: {
        campaignId,
        email,
        status: 'PENDING',
      },
      data: {
        status: 'REVOKED',
      },
    })

    const inviteToken = randomBytes(24).toString('hex')
    const tokenHash = hashInviteToken(inviteToken)
    const expiresInDays = input.expiresInDays || DEFAULT_INVITE_EXPIRY_DAYS
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

    const invite = await prisma.campaignInvite.create({
      data: {
        campaignId,
        email,
        role: input.role,
        tokenHash,
        expiresAt,
        invitedByUserId,
      },
      include: {
        invitedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

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
      ok: true,
      data: {
        invite: toInviteRow(invite),
        inviteToken,
        acceptUrl: getInviteAcceptUrl(inviteToken),
      },
    }
  }

  async acceptInvite(
    inviteToken: string,
    userId: string,
    userEmail: string
  ): Promise<ServiceResult<{
    campaignId: string
    campaignName: string
    role: CampaignRole
  }>> {
    const tokenHash = hashInviteToken(inviteToken)

    const invite = await prisma.campaignInvite.findUnique({
      where: { tokenHash },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!invite) {
      return {
        ok: false,
        statusCode: 404,
        code: 'INVITE_NOT_FOUND',
        message: 'Campaign invite not found.',
      }
    }

    const existingMember = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId: invite.campaignId,
          userId,
        },
      },
      select: {
        role: true,
      },
    })

    if (existingMember) {
      return {
        ok: true,
        data: {
          campaignId: invite.campaign.id,
          campaignName: invite.campaign.name,
          role: existingMember.role,
        },
      }
    }

    if (invite.status !== 'PENDING') {
      return {
        ok: false,
        statusCode: 409,
        code: 'INVITE_ALREADY_PROCESSED',
        message: 'This invite has already been processed.',
      }
    }

    if (invite.expiresAt < new Date()) {
      await prisma.campaignInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      })

      return {
        ok: false,
        statusCode: 410,
        code: 'INVITE_EXPIRED',
        message: 'This invite has expired.',
      }
    }

    if (normalizeEmail(invite.email) !== normalizeEmail(userEmail)) {
      return {
        ok: false,
        statusCode: 403,
        code: 'INVITE_EMAIL_MISMATCH',
        message: 'Invite email does not match your signed-in account.',
      }
    }

    const membership = await prisma.$transaction(async (tx) => {
      const member = await tx.campaignMember.upsert({
        where: {
          campaignId_userId: {
            campaignId: invite.campaignId,
            userId,
          },
        },
        update: {
          role: invite.role,
        },
        create: {
          campaignId: invite.campaignId,
          userId,
          role: invite.role,
          invitedByUserId: invite.invitedByUserId,
        },
      })

      await tx.campaignInvite.update({
        where: { id: invite.id },
        data: {
          status: 'ACCEPTED',
          acceptedByUserId: userId,
        },
      })

      return member
    })

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
      ok: true,
      data: {
        campaignId: invite.campaign.id,
        campaignName: invite.campaign.name,
        role: membership.role,
      },
    }
  }

  async updateMemberRole(
    campaignId: string,
    memberId: string,
    actorUserId: string,
    input: CampaignMemberRoleUpdateInput
  ): Promise<ServiceResult<CampaignMemberRow>> {
    const member = await prisma.campaignMember.findFirst({
      where: {
        id: memberId,
        campaignId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })

    if (!member) {
      return {
        ok: false,
        statusCode: 404,
        code: 'MEMBER_NOT_FOUND',
        message: 'Campaign member not found.',
      }
    }

    if (member.role === 'OWNER') {
      return {
        ok: false,
        statusCode: 409,
        code: 'OWNER_ROLE_CHANGE_FORBIDDEN',
        message: 'Use owner transfer to change owner role.',
      }
    }

    if (member.userId === actorUserId) {
      return {
        ok: false,
        statusCode: 400,
        code: 'SELF_ROLE_CHANGE_FORBIDDEN',
        message: 'You cannot change your own campaign role here.',
      }
    }

    const updated = await prisma.campaignMember.update({
      where: { id: member.id },
      data: { role: input.role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })

    await activityLogService.log({
      actorUserId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'CAMPAIGN_MEMBER_ROLE_UPDATED',
      targetType: 'CAMPAIGN_MEMBER',
      targetId: member.id,
      summary: 'Updated campaign member role.',
      metadata: {
        memberUserId: member.userId,
        previousRole: member.role,
        nextRole: updated.role,
      },
    })

    return {
      ok: true,
      data: toMemberRow(updated),
    }
  }

  async removeMember(
    campaignId: string,
    memberId: string,
    actorUserId: string
  ): Promise<ServiceResult<{ removedMemberId: string }>> {
    const member = await prisma.campaignMember.findFirst({
      where: {
        id: memberId,
        campaignId,
      },
      select: {
        id: true,
        role: true,
        userId: true,
      },
    })

    if (!member) {
      return {
        ok: false,
        statusCode: 404,
        code: 'MEMBER_NOT_FOUND',
        message: 'Campaign member not found.',
      }
    }

    if (member.role === 'OWNER') {
      return {
        ok: false,
        statusCode: 409,
        code: 'OWNER_REMOVE_FORBIDDEN',
        message: 'Owner cannot be removed. Transfer ownership first.',
      }
    }

    if (member.userId === actorUserId) {
      return {
        ok: false,
        statusCode: 400,
        code: 'SELF_REMOVE_FORBIDDEN',
        message: 'You cannot remove your own membership from this endpoint.',
      }
    }

    await prisma.campaignMember.delete({
      where: { id: member.id },
    })

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
      ok: true,
      data: {
        removedMemberId: member.id,
      },
    }
  }

  async transferOwnership(
    campaignId: string,
    ownerUserId: string,
    input: CampaignOwnerTransferInput
  ): Promise<ServiceResult<{
    campaignId: string
    newOwnerUserId: string
    previousOwnerUserId: string
    newOwnerMemberId: string
  }>> {
    const owner = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: {
        passwordHash: true,
      },
    })

    if (!owner?.passwordHash) {
      return {
        ok: false,
        statusCode: 400,
        code: 'PASSWORD_REQUIRED',
        message: 'Password login is not configured for this account.',
      }
    }

    const passwordValid = await verifyPassword(owner.passwordHash, input.password)
    if (!passwordValid) {
      return {
        ok: false,
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid password.',
        fields: {
          password: 'Password is incorrect',
        },
      }
    }

    const targetMember = await prisma.campaignMember.findFirst({
      where: {
        id: input.targetMemberId,
        campaignId,
      },
      select: {
        id: true,
        userId: true,
        role: true,
      },
    })

    if (!targetMember) {
      return {
        ok: false,
        statusCode: 404,
        code: 'MEMBER_NOT_FOUND',
        message: 'Target member was not found for this campaign.',
      }
    }

    if (targetMember.userId === ownerUserId) {
      return {
        ok: false,
        statusCode: 400,
        code: 'OWNER_TRANSFER_INVALID_TARGET',
        message: 'Select a different member to transfer ownership.',
      }
    }

    const transferResult = await prisma.$transaction(async (tx) => {
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          ownerId: targetMember.userId,
        },
      })

      await tx.campaignMember.upsert({
        where: {
          campaignId_userId: {
            campaignId,
            userId: ownerUserId,
          },
        },
        update: {
          role: 'COLLABORATOR',
        },
        create: {
          campaignId,
          userId: ownerUserId,
          role: 'COLLABORATOR',
          invitedByUserId: ownerUserId,
        },
      })

      const updatedOwnerMember = await tx.campaignMember.update({
        where: { id: targetMember.id },
        data: {
          role: 'OWNER',
        },
        select: {
          id: true,
          userId: true,
        },
      })

      return updatedOwnerMember
    })

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
      ok: true,
      data: {
        campaignId,
        newOwnerUserId: transferResult.userId,
        previousOwnerUserId: ownerUserId,
        newOwnerMemberId: transferResult.id,
      },
    }
  }
}
