import type { H3Event } from 'h3'
import type { CampaignRole, Prisma } from '@prisma/client'
import { prisma } from '#server/db/prisma'
import type { ApiResponse } from '#server/utils/http'
import { fail } from '#server/utils/http'

export type CampaignPermission =
  | 'campaign.read'
  | 'campaign.update'
  | 'campaign.delete'
  | 'campaign.members.manage'
  | 'campaign.settings.manage'
  | 'campaign.public.manage'
  | 'content.read'
  | 'content.write'
  | 'recording.upload'
  | 'recording.transcribe'
  | 'document.edit'
  | 'summary.run'

const allCampaignRoles: CampaignRole[] = ['OWNER', 'COLLABORATOR', 'VIEWER']

const permissionRoles: Record<CampaignPermission, CampaignRole[]> = {
  'campaign.read': allCampaignRoles,
  'campaign.update': ['OWNER', 'COLLABORATOR'],
  'campaign.delete': ['OWNER'],
  'campaign.members.manage': ['OWNER'],
  'campaign.settings.manage': ['OWNER'],
  'campaign.public.manage': ['OWNER'],
  'content.read': allCampaignRoles,
  'content.write': ['OWNER', 'COLLABORATOR'],
  'recording.upload': ['OWNER', 'COLLABORATOR'],
  'recording.transcribe': ['OWNER', 'COLLABORATOR'],
  'document.edit': ['OWNER', 'COLLABORATOR'],
  'summary.run': ['OWNER', 'COLLABORATOR'],
}

const hasRolePermission = (role: CampaignRole, permission: CampaignPermission) =>
  permissionRoles[permission].includes(role)

export type ResolvedCampaignAccess = {
  campaignId: string
  role: CampaignRole
  permissions: CampaignPermission[]
}

type CampaignAccessResolution = {
  exists: boolean
  access: ResolvedCampaignAccess | null
}

export const buildCampaignWhereForPermission = (
  userId: string,
  permission: CampaignPermission
): Prisma.CampaignWhereInput => {
  const allowedRoles = permissionRoles[permission]
  const nonOwnerRoles = allowedRoles.filter((role) => role !== 'OWNER')

  if (!allowedRoles.length) {
    return { id: '__forbidden__' }
  }

  if (allowedRoles.length === 1 && allowedRoles[0] === 'OWNER') {
    return { ownerId: userId }
  }

  if (!nonOwnerRoles.length) {
    return { ownerId: userId }
  }

  return {
    OR: [
      { ownerId: userId },
      {
        members: {
          some: {
            userId,
            role: { in: nonOwnerRoles },
          },
        },
      },
    ],
  }
}

export const resolveCampaignAccess = async (
  campaignId: string,
  userId: string,
  systemRole?: 'USER' | 'SYSTEM_ADMIN'
): Promise<CampaignAccessResolution> => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      ownerId: true,
      members: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
    },
  })

  if (!campaign) {
    return { exists: false, access: null }
  }

  const role: CampaignRole | null =
    systemRole === 'SYSTEM_ADMIN'
      ? 'OWNER'
      : campaign.ownerId === userId
        ? 'OWNER'
        : campaign.members[0]?.role || null

  if (!role) {
    return { exists: true, access: null }
  }

  const permissions = (Object.keys(permissionRoles) as CampaignPermission[]).filter((permission) =>
    hasRolePermission(role, permission)
  )

  return {
    exists: true,
  access: {
      campaignId: campaign.id,
      role,
      permissions,
    },
  }
}

type RequireCampaignPermissionSuccess = {
  ok: true
  session: Awaited<ReturnType<typeof requireUserSession>>
  access: ResolvedCampaignAccess
}

type RequireCampaignPermissionFailure = {
  ok: false
  response: ApiResponse<null>
}

export const requireCampaignPermission = async (
  event: H3Event,
  campaignId: string,
  permission: CampaignPermission
): Promise<RequireCampaignPermissionSuccess | RequireCampaignPermissionFailure> => {
  const session = await requireUserSession(event)
  const resolved = await resolveCampaignAccess(campaignId, session.user.id, session.user.systemRole)

  if (!resolved.exists) {
    return { ok: false, response: fail(event, 404, 'NOT_FOUND', 'Campaign not found') }
  }

  if (!resolved.access) {
    return { ok: false, response: fail(event, 403, 'FORBIDDEN', 'Campaign access is denied') }
  }

  if (!hasRolePermission(resolved.access.role, permission)) {
    return { ok: false, response: fail(event, 403, 'FORBIDDEN', 'You do not have permission for this action') }
  }

  return {
    ok: true,
    session,
    access: resolved.access,
  }
}

export const requireSystemAdmin = async (event: H3Event) => {
  const session = await requireUserSession(event)
  if (session.user.systemRole !== 'SYSTEM_ADMIN') {
    return { ok: false as const, response: fail(event, 403, 'FORBIDDEN', 'System administrator access is required') }
  }

  return { ok: true as const, session }
}
