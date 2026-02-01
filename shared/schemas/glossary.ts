import { z } from 'zod'

export const glossaryTypeSchema = z.enum(['PC', 'NPC', 'ITEM', 'LOCATION'])

export const glossaryCreateSchema = z.object({
  type: glossaryTypeSchema,
  name: z.string().min(2).max(120),
  aliases: z.string().max(500).optional(),
  description: z.string().min(2).max(10000),
})

export const glossaryUpdateSchema = z.object({
  type: glossaryTypeSchema.optional(),
  name: z.string().min(2).max(120).optional(),
  aliases: z.string().max(500).optional().nullable(),
  description: z.string().min(2).max(10000).optional(),
})

export type GlossaryCreateInput = z.infer<typeof glossaryCreateSchema>
export type GlossaryUpdateInput = z.infer<typeof glossaryUpdateSchema>
