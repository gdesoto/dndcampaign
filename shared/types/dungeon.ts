import type { z } from 'zod'
import type {
  campaignDungeonStatusSchema,
  dungeonMapSchema,
  DungeonExportInput,
  DungeonGeneratorConfigInput,
  DungeonLinkCreateInput,
  DungeonRegenerateInput,
  DungeonRoomUpdateInput,
  DungeonSnapshotCreateInput,
} from '../schemas/dungeon'

export type CampaignDungeonStatus = z.infer<typeof campaignDungeonStatusSchema>
export type CampaignDungeonGridType = DungeonMapData['gridType']
export type DungeonMapType = NonNullable<DungeonMapData['mapType']>
export type CampaignDungeonSnapshotType = DungeonSnapshotCreateInput['snapshotType']
export type DungeonExportFormat = DungeonExportInput['format']
export type CampaignDungeonRegenerateScope = DungeonRegenerateInput['scope']
export type DungeonRoomState = NonNullable<DungeonRoomUpdateInput['state']>
export type DungeonLinkType = DungeonLinkCreateInput['linkType']

// Newer settings remain optional for older saved records.
export type DungeonGeneratorConfig = Partial<DungeonGeneratorConfigInput> & Pick<
  DungeonGeneratorConfigInput,
  'gridType' | 'width' | 'height' | 'cellSize' | 'theme' | 'layout' | 'doors' | 'content'
>

export type DungeonMapData = z.infer<typeof dungeonMapSchema>
export type DungeonRoomGeometry = DungeonMapData['rooms'][number]
export type DungeonDoorGeometry = DungeonMapData['doors'][number]
export type DungeonTerrainFeature = NonNullable<DungeonMapData['terrain']>[number]
export type DungeonPortal = NonNullable<DungeonMapData['portals']>[number]
export type DungeonPassHistoryEntry = DungeonMapData['metadata']['passHistory'][number]

export type CampaignDungeonSummary = {
  id: string
  campaignId: string
  name: string
  status: CampaignDungeonStatus
  theme: string
  seed: string
  gridType: CampaignDungeonGridType
  generatorVersion: string
  roomCount: number
  mapType?: DungeonMapType
  floorCount?: number
  canDelete?: boolean
  createdAt: string
  updatedAt: string
}

export type CampaignDungeonDetail = CampaignDungeonSummary & {
  config: DungeonGeneratorConfig
  map: DungeonMapData
  playerView: Record<string, unknown> | null
}

export type CampaignDungeonRoom = {
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
  state: DungeonRoomState
  createdAt: string
  updatedAt: string
}

export type CampaignDungeonLink = {
  id: string
  dungeonId: string
  roomId: string | null
  linkType: DungeonLinkType
  targetId: string
  createdAt: string
}

export type CampaignDungeonSnapshot = {
  id: string
  dungeonId: string
  snapshotType: CampaignDungeonSnapshotType
  label: string | null
  seed: string
  generatorVersion: string
  mapType: DungeonMapType
  roomCount: number
  floorCount: number
  /** Present when the list is requested with `include=map`. */
  map?: DungeonMapData
  createdByUserId: string
  createdAt: string
}

/** A regeneration result names the snapshot taken beforehand so the client can undo it. */
export type CampaignDungeonRegenerateResult = CampaignDungeonDetail & { previousSnapshotId: string }

export type DungeonExportResult = {
  format: DungeonExportFormat
  filename: string
  contentType: string
  content: string
  encoding?: 'utf8' | 'base64'
}

export type DungeonPortableDocument = {
  schemaVersion: 1
  exportedAt: string
  source: {
    dungeonId: string
    campaignId: string
  }
  dungeon: {
    name: string
    status: CampaignDungeonStatus
    theme: string
    seed: string
    gridType: CampaignDungeonGridType
    generatorVersion: string
    config: DungeonGeneratorConfig
    map: DungeonMapData
    playerView: Record<string, unknown> | null
  }
  rooms: CampaignDungeonRoom[]
  links: CampaignDungeonLink[]
}
