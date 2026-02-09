import type { MapFeatureType } from './common'

export type CampaignMapSummaryDto = {
  id: string
  campaignId: string
  name: string
  slug: string
  isPrimary: boolean
  status: 'ACTIVE' | 'ARCHIVED'
  sourceType: 'AZGAAR_FULL_JSON'
  importVersion: number
  sourceFingerprint: string
  hasSvg: boolean
  createdAt: string
  updatedAt: string
  featureCounts: Record<MapFeatureType, number>
}
