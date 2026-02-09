import { z } from 'zod'
import { mapFeatureTypeSchema } from './common'

export const mapFeatureFilterSchema = z.object({
  types: z.array(mapFeatureTypeSchema).min(1).optional(),
  includeRemoved: z.coerce.boolean().optional().default(false),
})

export type MapFeatureFilterInput = z.infer<typeof mapFeatureFilterSchema>
