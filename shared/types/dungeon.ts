export type CampaignDungeonStatus = 'DRAFT' | 'READY' | 'ARCHIVED'
export type CampaignDungeonGridType = 'SQUARE'
export type CampaignDungeonSnapshotType = 'AUTO' | 'MANUAL' | 'PRE_REGENERATE'
export type DungeonExportFormat = 'JSON' | 'SVG' | 'PNG' | 'PDF'
export type CampaignDungeonRegenerateScope =
  | 'FULL'
  | 'LAYOUT'
  | 'DOORS'
  | 'TRAPS'
  | 'ENCOUNTERS'
  | 'TREASURE'

export type DungeonRoomState = 'UNSEEN' | 'EXPLORED' | 'CLEARED' | 'CONTESTED'
export type DungeonLinkType = 'SESSION' | 'QUEST' | 'MILESTONE' | 'GLOSSARY' | 'ENCOUNTER'

export type DungeonGeneratorLayoutConfig = {
  roomDensity: number
  minRoomSize: number
  maxRoomSize: number
  corridorStyle: 'STRAIGHT' | 'WINDING' | 'MIXED'
  connectivityStrictness: number
  secretRoomChance: number
}

export type DungeonGeneratorDoorConfig = {
  doorFrequency: number
  lockedDoorChance: number
  secretDoorChance: number
  specialDoorChance: number
}

export type DungeonGeneratorContentConfig = {
  trapDensity: number
  encounterDensity: number
  treasureDensity: number
  dressingDensity: number
}

export type DungeonGeneratorConfig = {
  gridType: CampaignDungeonGridType
  width: number
  height: number
  cellSize: number
  theme: string
  layout: DungeonGeneratorLayoutConfig
  doors: DungeonGeneratorDoorConfig
  content: DungeonGeneratorContentConfig
}

export type DungeonRoomGeometry = {
  id: string
  roomNumber: number
  x: number
  y: number
  width: number
  height: number
  isSecret: boolean
}

export type DungeonCorridorGeometry = {
  id: string
  fromRoomId: string
  toRoomId: string
  points: Array<{ x: number; y: number }>
}

export type DungeonDoorGeometry = {
  id: string
  x: number
  y: number
  corridorId: string
  isLocked: boolean
  isSecret: boolean
  isSpecial: boolean
}

export type DungeonWallSegment = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type DungeonTrap = {
  id: string
  roomId: string
  name: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  trigger: string
  effect: string
  detectDc: number
  disarmDc: number
  isLocked: boolean
}

export type DungeonEncounter = {
  id: string
  roomId: string
  title: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'DEADLY'
  summary: string
  isLocked: boolean
}

export type DungeonTreasure = {
  id: string
  roomId: string
  category: 'COIN' | 'ITEM' | 'ART' | 'MAGIC'
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'VERY_RARE'
  summary: string
  isLocked: boolean
}

export type DungeonDressing = {
  id: string
  roomId: string
  text: string
  isLocked: boolean
}

export type DungeonZone = {
  id: string
  type: 'SAFE' | 'HAZARD' | 'FACTION'
  label: string
  cells: Array<{ x: number; y: number }>
}

export type DungeonPassHistoryEntry = {
  pass: 'LAYOUT' | 'DOORS' | 'TRAPS' | 'ENCOUNTERS' | 'TREASURE' | 'DRESSING'
  scope: CampaignDungeonRegenerateScope
  startedAt: string
  finishedAt: string
  seed: string
  configHash: string
  changedCounts: {
    rooms?: number
    corridors?: number
    doors?: number
    traps?: number
    encounters?: number
    treasure?: number
    dressing?: number
  }
}

export type DungeonMapData = {
  schemaVersion: 1
  gridType: CampaignDungeonGridType
  width: number
  height: number
  cellSize: number
  rooms: DungeonRoomGeometry[]
  corridors: DungeonCorridorGeometry[]
  doors: DungeonDoorGeometry[]
  walls: DungeonWallSegment[]
  traps: DungeonTrap[]
  encounters: DungeonEncounter[]
  treasures: DungeonTreasure[]
  dressing: DungeonDressing[]
  zones: DungeonZone[]
  metadata: {
    algorithmVersion: string
    configHash: string
    generatedAt: string
    seed: string
    passHistory: DungeonPassHistoryEntry[]
  }
}

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

export type DungeonMapPatchActionType = 'ADD_ROOM' | 'MOVE_ROOM' | 'RESIZE_ROOM' | 'REMOVE_ROOM'

export type DungeonMapPatchActionTypeExtended =
  | DungeonMapPatchActionType
  | 'ADD_CORRIDOR'
  | 'REMOVE_CORRIDOR'
  | 'ADD_DOOR'
  | 'MOVE_DOOR'
  | 'REMOVE_DOOR'
  | 'TOGGLE_DOOR_SECRET'
  | 'TOGGLE_DOOR_LOCK'
  | 'DRAW_WALL_SEGMENT'
  | 'ERASE_WALL_SEGMENT'
  | 'RENUMBER_ROOMS'
  | 'PAINT_ZONE'
  | 'CLEAR_ZONE'
  | 'TOGGLE_LOCK'

export type CampaignDungeonSnapshot = {
  id: string
  dungeonId: string
  snapshotType: CampaignDungeonSnapshotType
  seed: string
  generatorVersion: string
  createdByUserId: string
  createdAt: string
}

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
