import { z } from 'zod'

const queryBooleanSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true
    }
    if (value === 0) {
      return false
    }
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false
    }
  }

  return value
}, z.boolean())

export const campaignJournalVisibilitySchema = z.enum(['MYSELF', 'DM', 'CAMPAIGN'])
export const campaignJournalTagTypeSchema = z.enum(['CUSTOM', 'GLOSSARY'])
export const campaignJournalDiscoverableVisibilitySchema = z.enum(['DM', 'CAMPAIGN'])
export const campaignJournalTransferHistoryActionSchema = z.enum([
  'DISCOVERED',
  'TRANSFERRED',
  'UNASSIGNED',
  'ARCHIVED',
  'UNARCHIVED',
])
export const campaignJournalNotificationTypeSchema = z.enum([
  'DISCOVERED',
  'TRANSFERRED',
  'ARCHIVED',
  'UNARCHIVED',
])

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
  mine: queryBooleanSchema.optional(),
  dmVisible: queryBooleanSchema.optional(),
  discoverable: queryBooleanSchema.optional(),
  heldByMe: queryBooleanSchema.optional(),
  includeArchived: queryBooleanSchema.optional(),
  archived: queryBooleanSchema.optional(),
  recentlyDiscovered: queryBooleanSchema.optional(),
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

export const campaignJournalDiscoverableUpdateSchema = z.object({
  isDiscoverable: z.boolean(),
  holderUserId: z.string().uuid().nullable().optional(),
  visibility: campaignJournalDiscoverableVisibilitySchema.optional(),
})

export const campaignJournalDiscoverInputSchema = z.object({
  holderUserId: z.string().uuid(),
  visibility: campaignJournalDiscoverableVisibilitySchema.optional(),
})

export const campaignJournalTransferInputSchema = z.object({
  toHolderUserId: z.string().uuid().nullable(),
  visibility: campaignJournalDiscoverableVisibilitySchema.optional(),
})

export const campaignJournalArchiveInputSchema = z.object({
  archived: z.boolean().default(true),
})

export const campaignJournalHistoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(campaignJournalListDefaultPage),
  pageSize: z.coerce.number().int().min(1).max(campaignJournalListMaxPageSize).default(campaignJournalListDefaultPageSize),
})

export const campaignJournalTransferHistoryItemSchema = z.object({
  id: z.string().uuid(),
  campaignJournalEntryId: z.string().uuid(),
  campaignId: z.string().uuid(),
  fromHolderUserId: z.string().uuid().nullable(),
  fromHolderUserName: z.string().nullable(),
  toHolderUserId: z.string().uuid().nullable(),
  toHolderUserName: z.string().nullable(),
  actorUserId: z.string().uuid(),
  actorUserName: z.string(),
  action: campaignJournalTransferHistoryActionSchema,
  createdAt: z.string().datetime(),
})

export const campaignJournalHistoryResponseSchema = z.object({
  items: z.array(campaignJournalTransferHistoryItemSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(1),
  }),
})

export const campaignJournalNotificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(campaignJournalListDefaultPage),
  pageSize: z.coerce.number().int().min(1).max(campaignJournalListMaxPageSize).default(campaignJournalListDefaultPageSize),
  since: z.string().datetime().optional(),
  type: campaignJournalNotificationTypeSchema.optional(),
})

export const campaignJournalNotificationItemSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  entryId: z.string().uuid(),
  type: campaignJournalNotificationTypeSchema,
  title: z.string().min(1).max(160),
  message: z.string().min(1).max(400),
  actorUserId: z.string().uuid().nullable(),
  actorUserName: z.string().nullable(),
  createdAt: z.string().datetime(),
})

export const campaignJournalNotificationListResponseSchema = z.object({
  items: z.array(campaignJournalNotificationItemSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(1),
  }),
})

export type CampaignJournalVisibilityInput = z.infer<typeof campaignJournalVisibilitySchema>
export type CampaignJournalTagTypeInput = z.infer<typeof campaignJournalTagTypeSchema>
export type CampaignJournalDiscoverableVisibilityInput = z.infer<typeof campaignJournalDiscoverableVisibilitySchema>
export type CampaignJournalTransferHistoryActionInput = z.infer<typeof campaignJournalTransferHistoryActionSchema>
export type CampaignJournalNotificationTypeInput = z.infer<typeof campaignJournalNotificationTypeSchema>
export type CampaignJournalTagInput = z.infer<typeof campaignJournalTagInputSchema>
export type CampaignJournalCreateInput = z.infer<typeof campaignJournalCreateSchema>
export type CampaignJournalUpdateInput = z.infer<typeof campaignJournalUpdateSchema>
export type CampaignJournalListQueryInput = z.infer<typeof campaignJournalListQuerySchema>
export type CampaignJournalTagSuggestQueryInput = z.infer<typeof campaignJournalTagSuggestQuerySchema>
export type CampaignJournalTagListQueryInput = z.infer<typeof campaignJournalTagListQuerySchema>
export type PublicCampaignJournalListQueryInput = z.infer<typeof publicCampaignJournalListQuerySchema>
export type CampaignJournalDiscoverableUpdateInput = z.infer<typeof campaignJournalDiscoverableUpdateSchema>
export type CampaignJournalDiscoverInput = z.infer<typeof campaignJournalDiscoverInputSchema>
export type CampaignJournalTransferInput = z.infer<typeof campaignJournalTransferInputSchema>
export type CampaignJournalArchiveInput = z.infer<typeof campaignJournalArchiveInputSchema>
export type CampaignJournalHistoryListQueryInput = z.infer<typeof campaignJournalHistoryListQuerySchema>
export type CampaignJournalTransferHistoryItem = z.infer<typeof campaignJournalTransferHistoryItemSchema>
export type CampaignJournalHistoryResponse = z.infer<typeof campaignJournalHistoryResponseSchema>
export type CampaignJournalNotificationListQueryInput = z.infer<typeof campaignJournalNotificationListQuerySchema>
export type CampaignJournalNotificationItem = z.infer<typeof campaignJournalNotificationItemSchema>
export type CampaignJournalNotificationListResponse = z.infer<typeof campaignJournalNotificationListResponseSchema>
