import { z } from 'zod'

export const apiKeyPermissionSchema = z.enum([
  'campaign.read', 'campaign.write', 'characters.read', 'characters.write',
  'glossary.read', 'glossary.write', 'quests.read', 'quests.write',
  'sessions.read', 'sessions.write', 'summaries.read', 'summaries.write',
  'transcripts.read', 'transcripts.write', 'encounters.read', 'encounters.write',
])
export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1).max(120), campaignIds: z.array(z.string().uuid()).min(1).max(100),
  permissions: z.array(apiKeyPermissionSchema).min(1), expiresAt: z.string().datetime().nullable().optional(),
})
export const apiKeyUpdateSchema = apiKeyCreateSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required')
export const apiKeyDtoSchema = z.object({
  id: z.string().uuid(), name: z.string(), prefix: z.string(), campaignIds: z.array(z.string().uuid()),
  permissions: z.array(apiKeyPermissionSchema), expiresAt: z.string().datetime().nullable(), lastUsedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(), createdAt: z.string().datetime(),
})
export const apiKeyListResponseSchema = z.object({ keys: z.array(apiKeyDtoSchema) })
export type ApiKeyPermission = z.infer<typeof apiKeyPermissionSchema>
export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>
export type ApiKeyUpdateInput = z.infer<typeof apiKeyUpdateSchema>
