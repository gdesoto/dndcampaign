import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '#server/db/prisma'
import type { Prisma } from '#server/db/prisma-client'
import { apiError } from '#server/utils/http'
import type { ApiKeyCreateInput, ApiKeyPermission, ApiKeyUpdateInput } from '#shared/schemas/api-key'
import { apiKeyPermissionSchema } from '#shared/schemas/api-key'
import { z } from 'zod'

const hashKey = (secret: string) => createHash('sha256').update(secret).digest('hex')
const keySecret = () => `dnd_${randomBytes(32).toString('base64url')}`

const include = { campaigns: { select: { campaignId: true } } } as const
type ApiKeyDtoRecord = Prisma.ApiKeyGetPayload<{ include: typeof include }>
type KeyRecord = Awaited<ReturnType<typeof findKeyBySecret>>
export type ApiKeyAuth = Omit<NonNullable<KeyRecord>, 'permissions'> & { permissions: ApiKeyPermission[] }

const dto = (key: ApiKeyDtoRecord) => ({
  id: key.id, name: key.name, prefix: key.prefix,
  campaignIds: key.campaigns.map((item) => item.campaignId),
  permissions: key.permissions as ApiKeyPermission[],
  expiresAt: key.expiresAt?.toISOString() ?? null,
  lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
  revokedAt: key.revokedAt?.toISOString() ?? null,
  createdAt: key.createdAt.toISOString(),
})

async function findKeyBySecret(secret: string) {
  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashKey(secret) }, include: { user: { select: { id: true, email: true, name: true, systemRole: true, avatarUrl: true, isActive: true, deletedAt: true } }, ...include } })
  if (!key || key.revokedAt || (key.expiresAt && key.expiresAt <= new Date()) || !key.user.isActive || key.user.deletedAt) return null
  return key
}

const assertCampaignSelection = async (userId: string, campaignIds: string[]) => {
  if (new Set(campaignIds).size !== campaignIds.length) throw apiError(400, 'VALIDATION_ERROR', 'Campaign IDs must be unique')
  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: campaignIds }, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  })
  if (campaigns.length !== campaignIds.length) throw apiError(403, 'FORBIDDEN', 'You do not have access to every selected campaign')
}

export class ApiKeyService {
  async list(userId: string) {
    const keys = await prisma.apiKey.findMany({ where: { userId }, include, orderBy: { createdAt: 'desc' } })
    return keys.map(dto)
  }

  async create(userId: string, input: ApiKeyCreateInput) {
    await assertCampaignSelection(userId, input.campaignIds)
    const secret = keySecret()
    const key = await prisma.apiKey.create({
      data: {
        userId, name: input.name, prefix: secret.slice(0, 12), keyHash: hashKey(secret),
        permissions: input.permissions, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        campaigns: { create: input.campaignIds.map((campaignId) => ({ campaignId })) },
      }, include,
    })
    return { key: dto(key), secret }
  }

  async update(userId: string, id: string, input: ApiKeyUpdateInput) {
    const existing = await prisma.apiKey.findFirst({ where: { id, userId } })
    if (!existing) throw apiError(404, 'NOT_FOUND', 'API key not found')
    if (input.campaignIds) {
      await assertCampaignSelection(userId, input.campaignIds)
    }
    const key = await prisma.apiKey.update({ where: { id }, data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.permissions === undefined ? {} : { permissions: input.permissions }),
      ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }),
      ...(input.campaignIds ? { campaigns: { deleteMany: {}, create: input.campaignIds.map((campaignId) => ({ campaignId })) } } : {}),
    }, include })
    return dto(key)
  }

  async revoke(userId: string, id: string) {
    const result = await prisma.apiKey.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } })
    if (!result.count) throw apiError(404, 'NOT_FOUND', 'API key not found')
    return { revoked: true }
  }

  async authenticate(secret: string): Promise<ApiKeyAuth | null> {
    const key = await findKeyBySecret(secret)
    if (!key) return null
    const permissions = z.array(apiKeyPermissionSchema).safeParse(key.permissions)
    if (!permissions.success) return null
    await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    return { ...key, permissions: permissions.data }
  }
}

export const apiKeyService = new ApiKeyService()
