import { z } from 'zod'
import { mapStatusSchema } from './common'

export const mapPatchSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  isPrimary: z.boolean().optional(),
  status: mapStatusSchema.optional(),
})

export type MapPatchInput = z.infer<typeof mapPatchSchema>
