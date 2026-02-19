import { z } from 'zod'

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

export const adminPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const adminUserListQuerySchema = adminPaginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  role: z.enum(['all', 'USER', 'SYSTEM_ADMIN']).default('all'),
})

export const adminUserUpdateSchema = z
  .object({
    isActive: z.boolean().optional(),
    systemRole: z.enum(['USER', 'SYSTEM_ADMIN']).optional(),
  })
  .refine((value) => value.isActive !== undefined || value.systemRole !== undefined, {
    message: 'At least one field is required',
  })

export const adminCampaignListQuerySchema = adminPaginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  archived: z.enum(['all', 'active', 'archived']).default('all'),
})

export const adminCampaignUpdateSchema = z
  .object({
    isArchived: z.boolean().optional(),
    transferOwnerUserId: z.string().uuid('Owner user id must be a UUID').optional(),
  })
  .refine((value) => value.isArchived !== undefined || value.transferOwnerUserId !== undefined, {
    message: 'At least one field is required',
  })

export const adminAnalyticsOverviewQuerySchema = z.object({
  at: dateStringSchema.optional(),
})

export const adminAnalyticsUsageQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  campaignLimit: z.coerce.number().int().min(1).max(500).default(100),
})

export const adminAnalyticsJobsQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
})

export const adminCsvFormatQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  campaignLimit: z.coerce.number().int().min(1).max(500).default(100),
})

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>
export type AdminCampaignListQuery = z.infer<typeof adminCampaignListQuerySchema>
export type AdminCampaignUpdateInput = z.infer<typeof adminCampaignUpdateSchema>
export type AdminAnalyticsOverviewQuery = z.infer<typeof adminAnalyticsOverviewQuerySchema>
export type AdminAnalyticsUsageQuery = z.infer<typeof adminAnalyticsUsageQuerySchema>
export type AdminAnalyticsJobsQuery = z.infer<typeof adminAnalyticsJobsQuerySchema>
