import { createHash, randomBytes } from 'node:crypto'
import { db } from '#server/db/client'
import { apiKey, apiKeyCampaign, campaign } from '#server/db/schema'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { apiError } from '#server/utils/http'
import type { ApiKeyCreateInput, ApiKeyPermission, ApiKeyUpdateInput } from '#shared/schemas/api-key'
import { apiKeyPermissionSchema } from '#shared/schemas/api-key'
import { z } from 'zod'

const hashKey = (secret: string) => createHash('sha256').update(secret).digest('hex')
const keySecret = () => `dnd_${randomBytes(32).toString('base64url')}`
const keyRelations = { campaigns: { columns: { campaignId: true } } } as const

type ApiKeyDtoRecord = typeof apiKey.$inferSelect & { campaigns: Array<{ campaignId: string }> }
type KeyRecord = ReturnType<typeof findKeyBySecret>
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

function findKeyBySecret(secret: string) {
  const key = db.query.apiKey.findFirst({
    where: eq(apiKey.keyHash, hashKey(secret)),
    with: {
      user: { columns: {
          id: true,
          email: true,
          name: true,
          systemRole: true,
          avatarUrl: true,
          isActive: true,
          deletedAt: true
        } },
      ...keyRelations
    }
  }).sync()
  if (!key || key.revokedAt || (key.expiresAt && key.expiresAt <= new Date()) || !key.user.isActive || key.user.deletedAt) return null
  return key
}

const assertCampaignSelection = (userId: string, campaignIds: string[]) => {
  if (new Set(campaignIds).size !== campaignIds.length) throw apiError(400, 'VALIDATION_ERROR', 'Campaign IDs must be unique')
  const campaigns = db.select({ id: campaign.id }).from(campaign).where(and(inArray(campaign.id, campaignIds), buildCampaignWhereForPermission(userId, 'campaign.read'))).all()
  if (campaigns.length !== campaignIds.length) throw apiError(403, 'FORBIDDEN', 'You do not have access to every selected campaign')
}

export class ApiKeyService {
  async list(userId: string) {
    return db.query.apiKey.findMany({
      where: eq(apiKey.userId, userId),
      with: keyRelations,
      orderBy: desc(apiKey.createdAt)
    }).sync().map(dto)
  }

  async create(userId: string, input: ApiKeyCreateInput) {
    assertCampaignSelection(userId, input.campaignIds)
    const secret = keySecret()
    const key = db.transaction((tx) => {
      const created = tx.insert(apiKey).values({
        userId,
        name: input.name,
        prefix: secret.slice(0, 12),
        keyHash: hashKey(secret),
        permissions: input.permissions,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
      }).returning().get()!;
      if (input.campaignIds.length)
        tx.insert(apiKeyCampaign).values(input.campaignIds.map((campaignId) => ({
          campaignId,
          apiKeyId: created.id
        }))).run();
      return tx.query.apiKey.findFirst({
        where: eq(apiKey.id, created.id),
        with: keyRelations
      }).sync()!;
    }, { behavior: 'immediate' })
    return { key: dto(key), secret }
  }

  async update(userId: string, id: string, input: ApiKeyUpdateInput) {
    const existing = db.query.apiKey.findFirst({ where: and(eq(apiKey.id, id), eq(apiKey.userId, userId)) }).sync()
    if (!existing) throw apiError(404, 'NOT_FOUND', 'API key not found')
    if (input.campaignIds) assertCampaignSelection(userId, input.campaignIds)
    const key = db.transaction((tx) => {
      tx.update(apiKey).set({
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.permissions === undefined ? {} : { permissions: input.permissions }),
        ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }),
        updatedAt: new Date()
      }).where(eq(apiKey.id, id)).run();
      if (input.campaignIds) {
        tx.delete(apiKeyCampaign).where(eq(apiKeyCampaign.apiKeyId, id)).run();
        if (input.campaignIds.length)
          tx.insert(apiKeyCampaign).values(input.campaignIds.map((campaignId) => ({
            campaignId,
            apiKeyId: id
          }))).run();
      }
      return tx.query.apiKey.findFirst({
        where: eq(apiKey.id, id),
        with: keyRelations
      }).sync()!;
    }, { behavior: 'immediate' })
    return dto(key)
  }

  async revoke(userId: string, id: string) {
    const result = db.update(apiKey).set({ revokedAt: new Date() }).where(and(eq(apiKey.id, id), eq(apiKey.userId, userId), isNull(apiKey.revokedAt))).run()
    if (!result.changes) throw apiError(404, 'NOT_FOUND', 'API key not found')
    return { revoked: true }
  }

  async authenticate(secret: string): Promise<ApiKeyAuth | null> {
    const key = findKeyBySecret(secret)
    if (!key) return null
    const permissions = z.array(apiKeyPermissionSchema).safeParse(key.permissions)
    if (!permissions.success) return null
    db.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.id, key.id)).run()
    return { ...key, permissions: permissions.data }
  }
}

export const apiKeyService = new ApiKeyService()
