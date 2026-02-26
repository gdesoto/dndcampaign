import { z } from 'zod'

export const campaignPublicAccessSections = [
  'characters',
  'recaps',
  'sessions',
  'glossary',
  'quests',
  'milestones',
  'maps',
  'journal',
] as const

export type CampaignPublicAccessSection = (typeof campaignPublicAccessSections)[number]

export const campaignPublicAccessMatrixSchema = z.object({
  showCharacters: z.boolean(),
  showRecaps: z.boolean(),
  showSessions: z.boolean(),
  showGlossary: z.boolean(),
  showQuests: z.boolean(),
  showMilestones: z.boolean(),
  showMaps: z.boolean(),
  showJournal: z.boolean(),
})

export const campaignPublicAccessUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  isListed: z.boolean().optional(),
  showCharacters: z.boolean().optional(),
  showRecaps: z.boolean().optional(),
  showSessions: z.boolean().optional(),
  showGlossary: z.boolean().optional(),
  showQuests: z.boolean().optional(),
  showMilestones: z.boolean().optional(),
  showMaps: z.boolean().optional(),
  showJournal: z.boolean().optional(),
})

export const campaignPublicAccessOwnerDtoSchema = z.object({
  campaignId: z.string().uuid(),
  isEnabled: z.boolean(),
  isListed: z.boolean(),
  publicSlug: z.string().min(16),
  publicUrl: z.string(),
  showCharacters: z.boolean(),
  showRecaps: z.boolean(),
  showSessions: z.boolean(),
  showGlossary: z.boolean(),
  showQuests: z.boolean(),
  showMilestones: z.boolean(),
  showMaps: z.boolean(),
  showJournal: z.boolean(),
  updatedAt: z.string().datetime(),
})

export const campaignPublicOverviewDtoSchema = z.object({
  campaign: z.object({
    name: z.string(),
    system: z.string(),
    description: z.string().nullable(),
    dungeonMasterName: z.string().nullable(),
  }),
  sections: campaignPublicAccessMatrixSchema,
})

export const publicCampaignDirectoryItemSchema = z.object({
  publicSlug: z.string(),
  publicUrl: z.string(),
  name: z.string(),
  system: z.string(),
  description: z.string().nullable(),
  dungeonMasterName: z.string().nullable(),
  updatedAt: z.string().datetime(),
})

export type CampaignPublicAccessUpdateInput = z.infer<typeof campaignPublicAccessUpdateSchema>
export type CampaignPublicAccessOwnerDto = z.infer<typeof campaignPublicAccessOwnerDtoSchema>
export type CampaignPublicOverviewDto = z.infer<typeof campaignPublicOverviewDtoSchema>
export type PublicCampaignDirectoryItem = z.infer<typeof publicCampaignDirectoryItemSchema>
