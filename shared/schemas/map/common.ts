import { z } from 'zod'

export const mapFeatureTypeValues = [
  'state',
  'province',
  'burg',
  'marker',
  'river',
  'route',
  'cell',
] as const

export const mapFeatureTypeSchema = z.enum(mapFeatureTypeValues)
export type MapFeatureType = z.infer<typeof mapFeatureTypeSchema>

export const defaultMapLayerTypes = ['state', 'marker', 'river', 'burg', 'route'] as const

export const mapStageActionValues = ['create', 'link', 'merge', 'skip'] as const
export const mapStageActionSchema = z.enum(mapStageActionValues)

export const mapReimportStrategyValues = [
  'replace_preserve_links',
  'replace_relink_by_name',
  'create_new_map',
] as const
export const mapReimportStrategySchema = z.enum(mapReimportStrategyValues)

export const mapStatusSchema = z.enum(['ACTIVE', 'ARCHIVED'])
