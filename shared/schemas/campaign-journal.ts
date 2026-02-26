import { z } from 'zod'

export const campaignJournalVisibilitySchema = z.enum(['MYSELF', 'DM', 'CAMPAIGN'])
export const campaignJournalTagTypeSchema = z.enum(['CUSTOM', 'GLOSSARY'])

export const campaignJournalListDefaultPage = 1
export const campaignJournalListDefaultPageSize = 20
export const campaignJournalListMaxPageSize = 100
export const campaignJournalTagSuggestDefaultLimit = 20
export const campaignJournalTagSuggestMaxLimit = 50

export const campaignJournalCustomTagInputSchema = z.object({
  type: z.literal('CUSTOM'),
  label: z.string().trim().min(1).max(80),
})

export const campaignJournalGlossaryTagInputSchema = z.object({
  type: z.literal('GLOSSARY'),
  glossaryEntryId: z.string().uuid(),
})

export const campaignJournalTagInputSchema = z.discriminatedUnion('type', [
  campaignJournalCustomTagInputSchema,
  campaignJournalGlossaryTagInputSchema,
])

export const campaignJournalCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  contentMarkdown: z.string().trim().min(1).max(20000),
  visibility: campaignJournalVisibilitySchema,
  sessionIds: z.array(z.string().uuid()).max(100).optional(),
  tags: z.array(campaignJournalTagInputSchema).max(200).optional(),
})

export const campaignJournalUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    contentMarkdown: z.string().trim().min(1).max(20000).optional(),
    visibility: campaignJournalVisibilitySchema.optional(),
    sessionIds: z.array(z.string().uuid()).max(100).optional(),
    tags: z.array(campaignJournalTagInputSchema).max(200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
    path: ['title'],
  })

export const campaignJournalListQuerySchema = z.object({
  visibility: campaignJournalVisibilitySchema.optional(),
  authorId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  tag: z.string().trim().min(1).max(80).optional(),
  tagType: campaignJournalTagTypeSchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  mine: z.coerce.boolean().optional(),
  dmVisible: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(campaignJournalListDefaultPage),
  pageSize: z.coerce.number().int().min(1).max(campaignJournalListMaxPageSize).default(campaignJournalListDefaultPageSize),
})

export const campaignJournalTagSuggestQuerySchema = z.object({
  query: z.string().trim().max(80).optional(),
  type: campaignJournalTagTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(campaignJournalTagSuggestMaxLimit).default(campaignJournalTagSuggestDefaultLimit),
})

export const campaignJournalTagListQuerySchema = z.object({
  type: campaignJournalTagTypeSchema.optional(),
  query: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(campaignJournalListDefaultPage),
  pageSize: z.coerce.number().int().min(1).max(campaignJournalListMaxPageSize).default(campaignJournalListDefaultPageSize),
})

export const publicCampaignJournalListQuerySchema = z.object({
  sessionId: z.string().uuid().optional(),
  tag: z.string().trim().min(1).max(80).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(campaignJournalListDefaultPage),
  pageSize: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(campaignJournalListMaxPageSize)
    .default(campaignJournalListDefaultPageSize),
})

export type CampaignJournalVisibilityInput = z.infer<typeof campaignJournalVisibilitySchema>
export type CampaignJournalTagTypeInput = z.infer<typeof campaignJournalTagTypeSchema>
export type CampaignJournalTagInput = z.infer<typeof campaignJournalTagInputSchema>
export type CampaignJournalCreateInput = z.infer<typeof campaignJournalCreateSchema>
export type CampaignJournalUpdateInput = z.infer<typeof campaignJournalUpdateSchema>
export type CampaignJournalListQueryInput = z.infer<typeof campaignJournalListQuerySchema>
export type CampaignJournalTagSuggestQueryInput = z.infer<typeof campaignJournalTagSuggestQuerySchema>
export type CampaignJournalTagListQueryInput = z.infer<typeof campaignJournalTagListQuerySchema>
export type PublicCampaignJournalListQueryInput = z.infer<typeof publicCampaignJournalListQuerySchema>
