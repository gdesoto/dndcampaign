import type { MapFeatureType } from './common'

export type CampaignMapCoordinates = {
  latT: number
  latN: number
  latS: number
  lonT: number
  lonW: number
  lonE: number
}

export type ViewerGeoJsonFeature = {
  id: string
  type: 'Feature'
  geometry: {
    type: string
    coordinates: unknown
  }
  properties: {
    featureType: MapFeatureType
    displayName: string
    description?: string | null
    externalId: string
    removed: boolean
    sourceRef: string
    glossaryLinked?: boolean
    glossaryMatched?: boolean
    glossaryLinkedOrMatched?: boolean
    [key: string]: unknown
  }
}

export type CampaignMapViewerDto = {
  map: {
    id: string
    campaignId: string
    name: string
    isPrimary: boolean
    status: 'ACTIVE' | 'ARCHIVED'
    importVersion: number
    sourceFingerprint: string
    bounds: [[number, number], [number, number]]
    mapCoordinates?: CampaignMapCoordinates
    defaultActiveLayers: MapFeatureType[]
  }
  features: ViewerGeoJsonFeature[]
}
