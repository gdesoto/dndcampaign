import { z } from 'zod'

export const campaignCreateSchema = z.object({
  name: z.string().min(2).max(120),
  system: z.string().max(120).optional(),
  dungeonMasterName: z.string().max(120).optional(),
  description: z.string().max(5000).optional(),
})

export const campaignUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  system: z.string().max(120).optional(),
  dungeonMasterName: z.string().max(120).optional(),
  description: z.string().max(5000).optional(),
  currentStatus: z.string().max(5000).optional(),
})

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>
