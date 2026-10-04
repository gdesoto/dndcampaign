import type { H3Event } from 'h3'
import type { CampaignRole } from '#server/db/schema'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq, and, or, inArray, type SQL } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { apiError } from '#server/utils/http'
import { requireApiUserSession } from '#server/utils/api-auth'

export type CampaignPermission =
  | 'campaign.read'
  | 'campaign.update'
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
  hasDmAccess: boolean
  permissions: CampaignPermission[]
}

/** A verified campaign member acting on a request: who they are plus what the handler already resolved. */
export type CampaignActor = {
  userId: string
  access: ResolvedCampaignAccess
}

/** Cheap follow-up check on an already-resolved access, for handlers that branch on the action. */
export const assertCampaignPermission = (access: ResolvedCampaignAccess, permission: CampaignPermission) => {
  if (!hasRolePermission(access.role, permission)) {
    throw apiError(403, 'FORBIDDEN', 'You do not have permission for this action')
  }
}

export type CampaignDmAccessSubject = Pick<ResolvedCampaignAccess, 'role' | 'hasDmAccess'>

export const hasCampaignDmAccess = (access: CampaignDmAccessSubject) =>
  access.role === 'OWNER' || Boolean(access.hasDmAccess)

type CampaignAccessResolution = {
  exists: boolean
  access: ResolvedCampaignAccess | null
}

export const buildCampaignWhereForPermission = (
  userId: string,
  permission: CampaignPermission,
  campaignIdColumn: AnySQLiteColumn = tables.campaign.id
): SQL => {
  const nonOwnerRoles = permissionRoles[permission].filter((role) => role !== 'OWNER')
  return inArray(campaignIdColumn, db.select({ id: tables.campaign.id }).from(tables.campaign).where(
    or(
      eq(tables.campaign.ownerId, userId),
      nonOwnerRoles.length ? inArray(tables.campaign.id,
        db.select({ campaignId: tables.campaignMember.campaignId }).from(tables.campaignMember).where(
          and(eq(tables.campaignMember.userId, userId), inArray(tables.campaignMember.role, nonOwnerRoles))
        )
      ) : undefined
    )
  ))
}

export const resolveCampaignAccess = async (
  campaignId: string,
  userId: string,
  systemRole?: 'USER' | 'SYSTEM_ADMIN'
): Promise<CampaignAccessResolution> => {
  const campaign = await db.query.campaign.findFirst({
    where: eq(tables.campaign.id, campaignId),
    columns: {
      id: true,
      ownerId: true
    },
    with: { members: {
        where: eq(tables.campaignMember.userId, userId),
        limit: 1,
        columns: {
          role: true,
          hasDmAccess: true
        }
      } }
  }).sync()

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
      hasDmAccess: role === 'OWNER' ? true : Boolean(campaign.members[0]?.hasDmAccess),
      permissions,
    },
  }
}

export const requireCampaignPermission = async (
  event: H3Event,
  campaignId: string,
  permission: CampaignPermission
) => {
  const session = await requireApiUserSession(event)
  const resolved = await resolveCampaignAccess(campaignId, session.user.id, session.user.systemRole)

  if (!resolved.exists) {
    throw apiError(404, 'NOT_FOUND', 'Campaign not found')
  }

  if (!resolved.access) {
    throw apiError(403, 'FORBIDDEN', 'Campaign access is denied')
  }

  if (!hasRolePermission(resolved.access.role, permission)) {
    throw apiError(403, 'FORBIDDEN', 'You do not have permission for this action')
  }

  return {
    session,
    access: resolved.access,
    actor: { userId: session.user.id, access: resolved.access } satisfies CampaignActor,
  }
}

export const requireSystemAdmin = async (event: H3Event) => {
  const session = await requireUserSession(event)
  if (session.user.systemRole !== 'SYSTEM_ADMIN') {
    throw apiError(403, 'FORBIDDEN', 'System administrator access is required')
  }

  return { session }
}
