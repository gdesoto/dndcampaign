import { z } from 'zod'

export const questStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'FAILED', 'ON_HOLD'])
export const questTypeSchema = z.enum(['MAIN', 'SIDE', 'PLAYER'])

export const questCreateSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(10000).optional(),
  type: questTypeSchema.optional(),
  status: questStatusSchema.optional(),
  progressNotes: z.string().max(10000).optional(),
})

export const questUpdateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(10000).optional().nullable(),
  type: questTypeSchema.optional(),
  status: questStatusSchema.optional(),
  progressNotes: z.string().max(10000).optional().nullable(),
})

export type QuestCreateInput = z.infer<typeof questCreateSchema>
export type QuestUpdateInput = z.infer<typeof questUpdateSchema>
