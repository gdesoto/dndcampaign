import { z } from 'zod'

export const milestoneCreateSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(10000).optional(),
})

export const milestoneUpdateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(10000).optional().nullable(),
  isComplete: z.boolean().optional(),
  completedAt: z.string().datetime().optional().nullable(),
})

export type MilestoneCreateInput = z.infer<typeof milestoneCreateSchema>
export type MilestoneUpdateInput = z.infer<typeof milestoneUpdateSchema>
