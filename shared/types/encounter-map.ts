import type { z } from 'zod'
import type {
  campaignEncounterMapStatusSchema,
  encounterMapSchema,
  EncounterMapExportInput,
  EncounterMapGeneratorConfigInput,
  EncounterMapLinkCreateInput,
  EncounterMapRegenerateInput,
  EncounterMapRoomUpdateInput,
  EncounterMapSnapshotCreateInput,
} from '../schemas/encounter-map'

export type CampaignEncounterMapStatus = z.infer<typeof campaignEncounterMapStatusSchema>
export type CampaignEncounterMapGridType = EncounterMapData['gridType']
export type EncounterMapType = NonNullable<EncounterMapData['mapType']>
export type CampaignEncounterMapSnapshotType = EncounterMapSnapshotCreateInput['snapshotType']
export type EncounterMapExportFormat = EncounterMapExportInput['format']
export type CampaignEncounterMapRegenerateScope = EncounterMapRegenerateInput['scope']
export type EncounterMapRoomState = NonNullable<EncounterMapRoomUpdateInput['state']>
export type EncounterMapLinkType = EncounterMapLinkCreateInput['linkType']

export type EncounterMapGeneratorConfig = EncounterMapGeneratorConfigInput

export type EncounterMapData = z.infer<typeof encounterMapSchema>
export type EncounterMapRoomGeometry = EncounterMapData['rooms'][number]
export type EncounterMapDoorGeometry = EncounterMapData['doors'][number]
export type EncounterMapTerrainFeature = NonNullable<EncounterMapData['terrain']>[number]
export type EncounterMapPortal = NonNullable<EncounterMapData['portals']>[number]
export type EncounterMapPassHistoryEntry = EncounterMapData['metadata']['passHistory'][number]

export type CampaignEncounterMapSummary = {
  id: string
  campaignId: string
  name: string
  status: CampaignEncounterMapStatus
  theme: string
  seed: string
  gridType: CampaignEncounterMapGridType
  generatorVersion: string
  roomCount: number
  mapType?: EncounterMapType
  floorCount?: number
  canDelete?: boolean
  createdAt: string
  updatedAt: string
}

export type CampaignEncounterMapDetail = CampaignEncounterMapSummary & {
  config: EncounterMapGeneratorConfig
  map: EncounterMapData
  playerView: Record<string, unknown> | null
}

export type CampaignEncounterMapRoom = {
  id: string
  dungeonId: string
  roomNumber: number
  name: string
  description: string | null
  gmNotes: string | null
  playerNotes: string | null
  readAloud: string | null
  tags: string[]
  bounds: {
    x: number
    y: number
    width: number
    height: number
    floor?: number
  } | null
  state: EncounterMapRoomState
  createdAt: string
  updatedAt: string
}

export type CampaignEncounterMapLink = {
  id: string
  dungeonId: string
  roomId: string | null
  linkType: EncounterMapLinkType
  targetId: string
  createdAt: string
}

export type CampaignEncounterMapSnapshot = {
  id: string
  dungeonId: string
  snapshotType: CampaignEncounterMapSnapshotType
  label: string | null
  seed: string
  generatorVersion: string
  mapType: EncounterMapType
  roomCount: number
  floorCount: number
  /** Present when the list is requested with `include=map`. */
  map?: EncounterMapData
  createdByUserId: string
  createdAt: string
}

/** A regeneration result names the snapshot taken beforehand so the client can undo it. */
export type CampaignEncounterMapRegenerateResult = CampaignEncounterMapDetail & { previousSnapshotId: string }

export type EncounterMapExportResult = {
  format: EncounterMapExportFormat
  filename: string
  contentType: string
  content: string
  encoding?: 'utf8' | 'base64'
}

export type EncounterMapPortableDocument = {
  schemaVersion: 1
  exportedAt: string
  source: {
    dungeonId: string
    campaignId: string
  }
  dungeon: {
    name: string
    status: CampaignEncounterMapStatus
    theme: string
    seed: string
    gridType: CampaignEncounterMapGridType
    generatorVersion: string
    // Exports preserve older saved settings without adding normalized defaults.
    config: Partial<EncounterMapGeneratorConfig> & Pick<
      EncounterMapGeneratorConfig,
      'gridType' | 'width' | 'height' | 'cellSize' | 'theme' | 'layout' | 'doors' | 'content'
    >
    map: EncounterMapData
    playerView: Record<string, unknown> | null
  }
  rooms: CampaignEncounterMapRoom[]
  links: CampaignEncounterMapLink[]
}
