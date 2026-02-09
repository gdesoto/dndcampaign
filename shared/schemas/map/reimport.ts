import { z } from 'zod'
import { mapReimportStrategySchema } from './common'

export const mapReimportApplySchema = z.object({
  strategy: mapReimportStrategySchema,
  mapName: z.string().min(2).max(160).optional(),
  keepPrimary: z.coerce.boolean().optional().default(false),
})

export type MapReimportApplyInput = z.infer<typeof mapReimportApplySchema>
