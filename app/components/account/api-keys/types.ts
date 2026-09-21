import type { apiKeyDtoSchema } from '#shared/schemas/api-key'
import type { infer as ZodInfer } from 'zod'

export const apiKeyResources = [
  { key: 'campaign', label: 'Campaign', description: 'Campaign information' },
  { key: 'characters', label: 'Characters', description: 'Campaign characters and details' },
  { key: 'glossary', label: 'Glossary', description: 'Glossary entries' },
  { key: 'quests', label: 'Quests', description: 'Quests and status' },
  { key: 'sessions', label: 'Sessions', description: 'Session information' },
  { key: 'summaries', label: 'Summaries', description: 'Session summaries' },
  { key: 'transcripts', label: 'Transcripts', description: 'Transcript sections and search' },
  { key: 'encounters', label: 'Encounters', description: 'Encounters and combat state' },
] as const

export type ApiKeyResource = typeof apiKeyResources[number]['key']
export type ApiKeyPermissionsState = Record<ApiKeyResource, { read: boolean; write: boolean }>
export type ApiKeyCampaignOption = { id: string; name: string }
export type ApiKeyRecord = ZodInfer<typeof apiKeyDtoSchema>
export type ApiKeyDraft = {
  name: string
  campaignIds: string[]
  permissions: ApiKeyPermissionsState
  expiresAt: string
}
