import { z } from 'zod'

export const sessionCreateSchema = z.object({
  title: z.string().min(2).max(200),
  sessionNumber: z.number().int().positive().optional(),
  playedAt: z.string().datetime().optional(),
  guestDungeonMasterName: z.string().max(120).optional(),
  notes: z.string().max(10000).optional(),
})

export const sessionUpdateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  sessionNumber: z.number().int().positive().optional(),
  playedAt: z.string().datetime().optional().nullable(),
  guestDungeonMasterName: z.string().max(120).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
})

export type SessionCreateInput = z.infer<typeof sessionCreateSchema>
export type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>
