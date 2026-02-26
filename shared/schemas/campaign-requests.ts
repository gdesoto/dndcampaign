import { z } from 'zod'

export const campaignRequestTypeSchema = z.enum(['ITEM', 'PLOT_POINT'])
export const campaignRequestVisibilitySchema = z.enum(['PRIVATE', 'PUBLIC'])
export const campaignRequestStatusSchema = z.enum(['PENDING', 'APPROVED', 'DENIED', 'CANCELED'])
export const campaignRequestDecisionSchema = z.enum(['APPROVED', 'DENIED'])

export const campaignRequestListDefaultPage = 1
export const campaignRequestListDefaultPageSize = 20
export const campaignRequestListMaxPageSize = 100

export const campaignRequestCreateSchema = z.object({
  type: campaignRequestTypeSchema,
  visibility: campaignRequestVisibilitySchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(4000),
})

export const campaignRequestUpdateSchema = z
  .object({
    type: campaignRequestTypeSchema.optional(),
    visibility: campaignRequestVisibilitySchema.optional(),
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
    path: ['title'],
  })

export const campaignRequestDecisionInputSchema = z.object({
  decision: campaignRequestDecisionSchema,
  decisionNote: z.string().trim().max(2000).optional(),
})

export const campaignRequestListQuerySchema = z.object({
  visibility: campaignRequestVisibilitySchema.optional(),
  status: campaignRequestStatusSchema.optional(),
  type: campaignRequestTypeSchema.optional(),
  mine: z.coerce.boolean().optional(),
  moderationQueue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(campaignRequestListDefaultPage),
  pageSize: z.coerce.number().int().min(1).max(campaignRequestListMaxPageSize).default(campaignRequestListDefaultPageSize),
})

export const campaignRequestVoteCreateSchema = z.object({})
export const campaignRequestVoteDeleteMineSchema = z.object({})
export const campaignRequestCancelSchema = z.object({})

export type CampaignRequestTypeInput = z.infer<typeof campaignRequestTypeSchema>
export type CampaignRequestVisibilityInput = z.infer<typeof campaignRequestVisibilitySchema>
export type CampaignRequestStatusInput = z.infer<typeof campaignRequestStatusSchema>
export type CampaignRequestDecisionInput = z.infer<typeof campaignRequestDecisionInputSchema>
export type CampaignRequestCreateInput = z.infer<typeof campaignRequestCreateSchema>
export type CampaignRequestUpdateInput = z.infer<typeof campaignRequestUpdateSchema>
export type CampaignRequestListQueryInput = z.infer<typeof campaignRequestListQuerySchema>
