import { z } from 'zod'
import { glossaryTypeSchema } from '../glossary'
import { mapFeatureTypeSchema, mapStageActionSchema } from './common'

export const mapGlossaryStageSchema = z.object({
  featureIds: z.array(z.string().uuid()).min(1),
  featureTypes: z.array(mapFeatureTypeSchema).optional(),
})

export const mapGlossaryCommitItemSchema = z.object({
  featureId: z.string().uuid(),
  action: mapStageActionSchema,
  glossaryEntryId: z.string().uuid().optional(),
  glossaryPayload: z
    .object({
      type: glossaryTypeSchema.default('LOCATION'),
      name: z.string().min(2).max(120),
      aliases: z.string().max(500).optional(),
      description: z.string().min(2).max(10000),
    })
    .optional(),
})

export const mapGlossaryCommitSchema = z.object({
  items: z.array(mapGlossaryCommitItemSchema).min(1),
})

export type MapGlossaryStageInput = z.infer<typeof mapGlossaryStageSchema>
export type MapGlossaryCommitInput = z.infer<typeof mapGlossaryCommitSchema>
