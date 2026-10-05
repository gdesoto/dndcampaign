import { z } from 'zod'

export const campaignDungeonStatusSchema = z.enum(['DRAFT', 'READY', 'ARCHIVED'])
export const campaignDungeonGridTypeSchema = z.enum(['SQUARE'])
export const dungeonMapTypeSchema = z.enum(['DUNGEON', 'BUILDING', 'FOREST'])
const dungeonFloorSchema = z.number().int().min(0).max(3)
export const campaignDungeonRegenerateScopeSchema = z.enum([
  'FULL',
  'LAYOUT',
  'DOORS',
  'TRAPS',
  'ENCOUNTERS',
  'TREASURE',
])
export const campaignDungeonSnapshotTypeSchema = z.enum(['AUTO', 'MANUAL', 'PRE_REGENERATE'])
export const dungeonExportFormatSchema = z.enum(['JSON', 'SVG', 'PNG', 'PDF'])
export const dungeonLinkTypeSchema = z.enum(['SESSION', 'QUEST', 'MILESTONE', 'GLOSSARY', 'ENCOUNTER'])
export const dungeonRoomStateSchema = z.enum(['UNSEEN', 'EXPLORED', 'CLEARED', 'CONTESTED'])
export const dungeonZoneTypeSchema = z.enum(['SAFE', 'HAZARD', 'FACTION'])
export const dungeonDifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD', 'DEADLY'])
export const dungeonTrapSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH'])
export const dungeonTreasureCategorySchema = z.enum(['COIN', 'ITEM', 'ART', 'MAGIC'])
export const dungeonTreasureRaritySchema = z.enum(['COMMON', 'UNCOMMON', 'RARE', 'VERY_RARE'])

export const dungeonEncounterFlowSchema = z.enum(['LINEAR', 'BRANCHING', 'LOOP'])
export const dungeonEncounterScaleSchema = z.enum(['SINGLE', 'SEQUENCE', 'COMPLEX'])

export const dungeonAccessPointsConfigSchema = z.object({
  entrances: z.number().int().min(1).max(3).default(1),
  exits: z.number().int().min(1).max(2).default(1),
  entranceSide: z.enum(['AUTO', 'NORTH', 'EAST', 'SOUTH', 'WEST']).default('AUTO'),
  concealedEntrance: z.boolean().default(false),
})

export const dungeonTacticalTerrainConfigSchema = z.object({
  cover: z.enum(['NONE', 'LIGHT', 'HEAVY']).default('LIGHT'),
  elevation: z.boolean().default(false),
  difficultTerrain: z.boolean().default(false),
  hazards: z.boolean().default(false),
  sightlines: z.enum(['OPEN', 'MIXED', 'BROKEN']).default('MIXED'),
})

export const dungeonVerticalConnectionsConfigSchema = z.object({
  basement: z.boolean().default(false),
  staircases: z.enum(['SINGLE', 'DUAL']).default('SINGLE'),
  ladders: z.boolean().default(false),
  balconies: z.boolean().default(false),
  bridges: z.boolean().default(false),
})

export const dungeonLayoutConfigSchema = z.object({
  roomDensity: z.number().min(0.02).max(0.8).default(0.25),
  minRoomSize: z.number().int().min(3).max(24).default(4),
  maxRoomSize: z.number().int().min(4).max(36).default(10),
  corridorStyle: z.enum(['STRAIGHT', 'WINDING', 'MIXED']).default('MIXED'),
  connectivityStrictness: z.number().min(0).max(1).default(0.7),
  secretRoomChance: z.number().min(0).max(1).default(0.1),
})

export const dungeonDoorConfigSchema = z.object({
  doorFrequency: z.number().min(0).max(1).default(0.65),
  lockedDoorChance: z.number().min(0).max(1).default(0.2),
  secretDoorChance: z.number().min(0).max(1).default(0.08),
  specialDoorChance: z.number().min(0).max(1).default(0.05),
})

export const dungeonContentConfigSchema = z.object({
  trapDensity: z.number().min(0).max(1).default(0.15),
  encounterDensity: z.number().min(0).max(1).default(0.3),
  treasureDensity: z.number().min(0).max(1).default(0.2),
  dressingDensity: z.number().min(0).max(1).default(0.35),
})

export const dungeonGeneratorConfigSchema = z
  .object({
    mapType: dungeonMapTypeSchema.default('DUNGEON'),
    floorCount: z.number().int().min(1).max(4).default(1),
    encounterFlow: dungeonEncounterFlowSchema.default('BRANCHING'),
    encounterScale: dungeonEncounterScaleSchema.default('SEQUENCE'),
    accessPoints: dungeonAccessPointsConfigSchema.prefault({}),
    tacticalTerrain: dungeonTacticalTerrainConfigSchema.prefault({}),
    verticalConnections: dungeonVerticalConnectionsConfigSchema.prefault({}),
    gridType: campaignDungeonGridTypeSchema.default('SQUARE'),
    width: z.number().int().min(20).max(400).default(40),
    height: z.number().int().min(20).max(400).default(40),
    cellSize: z.number().int().min(16).max(128).default(32),
    theme: z.string().trim().min(1).max(80).default('ruins'),
    layout: dungeonLayoutConfigSchema.prefault({}),
    doors: dungeonDoorConfigSchema.prefault({}),
    content: dungeonContentConfigSchema.prefault({}),
  })
  .superRefine((value, ctx) => {
    if (value.mapType !== 'BUILDING' && value.floorCount !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['floorCount'], message: 'Multiple floors are available for building maps.' })
    }
    const vertical = value.verticalConnections
    if ((vertical.basement || vertical.staircases === 'DUAL' || vertical.ladders || vertical.balconies)
      && (value.mapType !== 'BUILDING' || value.floorCount < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verticalConnections'],
        message: 'Basements, dual staircases, ladders, and balconies require a building with at least two floors.',
      })
    }
    if (vertical.balconies && value.floorCount < (vertical.basement ? 3 : 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verticalConnections', 'balconies'],
        message: 'Balconies require an upper floor above ground.',
      })
    }
    if (value.layout.maxRoomSize <= value.layout.minRoomSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['layout.maxRoomSize'],
        message: 'Max room size must be greater than min room size.',
      })
    }
  })

export const dungeonMapRoomSchema = z.object({
  id: z.string().min(1),
  roomNumber: z.number().int().positive(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  isSecret: z.boolean().default(false),
  floor: dungeonFloorSchema.optional(),
  label: z.string().trim().min(1).max(100).optional(),
  kind: z.enum(['ROOM', 'HALL', 'STAIRWELL', 'CLEARING', 'BALCONY']).optional(),
})

export const dungeonMapCorridorSchema = z.object({
  id: z.string().min(1),
  fromRoomId: z.string().min(1),
  toRoomId: z.string().min(1),
  points: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(2),
  kind: z.enum(['PASSAGE', 'BRIDGE']).optional(),
})

export const dungeonMapDoorSchema = z.object({
  id: z.string().min(1),
  x: z.number().int(),
  y: z.number().int(),
  corridorId: z.string().min(1),
  isLocked: z.boolean().default(false),
  isSecret: z.boolean().default(false),
  isSpecial: z.boolean().default(false),
})

export const dungeonMapWallSegmentSchema = z.object({
  id: z.string().min(1),
  x1: z.number().int(),
  y1: z.number().int(),
  x2: z.number().int(),
  y2: z.number().int(),
  floor: dungeonFloorSchema.optional(),
})

export const dungeonTerrainFeatureSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['TREE', 'ROCK', 'BRUSH', 'COVER', 'ELEVATION', 'DIFFICULT', 'HAZARD']),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  floor: dungeonFloorSchema.optional(),
  roomId: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(100).optional(),
  elevationFeet: z.number().min(0).max(100).optional(),
  blocksMovement: z.boolean().optional(),
  blocksSight: z.boolean().optional(),
})

export const dungeonStairSchema = z.object({
  id: z.string().min(1),
  fromRoomId: z.string().min(1),
  toRoomId: z.string().min(1),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  kind: z.enum(['STAIRS', 'LADDER']).optional(),
})

export const dungeonPortalSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['ENTRANCE', 'EXIT']),
  roomId: z.string().min(1),
  points: z.array(z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() })).min(2),
  isSecret: z.boolean().optional(),
  label: z.string().trim().min(1).max(100).optional(),
})

export const dungeonFlowPlanSchema = z.object({
  style: dungeonEncounterFlowSchema,
  entryRoomId: z.string().min(1),
  objectiveRoomId: z.string().min(1),
  exitRoomId: z.string().min(1),
  routeRoomIds: z.array(z.string().min(1)).min(3).max(5000),
})

export const dungeonTrapSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  severity: dungeonTrapSeveritySchema,
  trigger: z.string().trim().min(1).max(500),
  effect: z.string().trim().min(1).max(500),
  detectDc: z.number().int().min(1).max(40),
  disarmDc: z.number().int().min(1).max(40),
  isLocked: z.boolean().default(false),
})

export const dungeonEncounterSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  difficulty: dungeonDifficultySchema,
  summary: z.string().trim().min(1).max(500),
  isLocked: z.boolean().default(false),
})

export const dungeonTreasureSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  category: dungeonTreasureCategorySchema,
  rarity: dungeonTreasureRaritySchema,
  summary: z.string().trim().min(1).max(500),
  isLocked: z.boolean().default(false),
})

export const dungeonDressingSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  text: z.string().trim().min(1).max(500),
  isLocked: z.boolean().default(false),
})

export const dungeonZoneSchema = z.object({
  id: z.string().min(1),
  type: dungeonZoneTypeSchema,
  label: z.string().trim().min(1).max(100),
  cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1).max(5000),
  floor: dungeonFloorSchema.optional(),
})

export const dungeonPassHistoryEntrySchema = z.object({
  pass: z.enum(['LAYOUT', 'DOORS', 'TRAPS', 'ENCOUNTERS', 'TREASURE', 'DRESSING']),
  scope: campaignDungeonRegenerateScopeSchema,
  startedAt: z.string().min(1),
  finishedAt: z.string().min(1),
  seed: z.string().min(1),
  configHash: z.string().min(1),
  changedCounts: z.object({
    rooms: z.number().int().nonnegative().optional(),
    corridors: z.number().int().nonnegative().optional(),
    doors: z.number().int().nonnegative().optional(),
    traps: z.number().int().nonnegative().optional(),
    encounters: z.number().int().nonnegative().optional(),
    treasure: z.number().int().nonnegative().optional(),
    dressing: z.number().int().nonnegative().optional(),
  }),
})

export const dungeonMapSchema = z.object({
  schemaVersion: z.literal(1),
  mapType: dungeonMapTypeSchema.optional(),
  floorCount: z.number().int().min(1).max(4).optional(),
  floorLabels: z.array(z.string().trim().min(1).max(100)).optional(),
  gridType: campaignDungeonGridTypeSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  cellSize: z.number().int().positive(),
  rooms: z.array(dungeonMapRoomSchema),
  corridors: z.array(dungeonMapCorridorSchema),
  doors: z.array(dungeonMapDoorSchema),
  walls: z.array(dungeonMapWallSegmentSchema).default([]),
  traps: z.array(dungeonTrapSchema).default([]),
  encounters: z.array(dungeonEncounterSchema).default([]),
  treasures: z.array(dungeonTreasureSchema).default([]),
  dressing: z.array(dungeonDressingSchema).default([]),
  zones: z.array(dungeonZoneSchema).default([]),
  terrain: z.array(dungeonTerrainFeatureSchema).optional(),
  stairs: z.array(dungeonStairSchema).optional(),
  portals: z.array(dungeonPortalSchema).optional(),
  flow: dungeonFlowPlanSchema.optional(),
  metadata: z.object({
    algorithmVersion: z.string().min(1),
    configHash: z.string().min(1),
    generatedAt: z.string().min(1),
    seed: z.string().min(1),
    passHistory: z.array(dungeonPassHistoryEntrySchema).default([]),
  }),
}).superRefine((map, ctx) => {
  const floorCount = map.floorCount ?? 1
  if (map.floorLabels && map.floorLabels.length !== floorCount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['floorLabels'], message: 'Floor labels must match the map floor count.' })
  }
  if ((map.mapType ?? 'DUNGEON') !== 'BUILDING' && floorCount > 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['floorCount'], message: 'Only building maps can contain multiple floors.' })
  }
  for (const collection of ['rooms', 'walls', 'zones', 'terrain'] as const) {
    for (const [index, entry] of (map[collection] ?? []).entries()) {
      if ((entry.floor ?? 0) >= floorCount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [collection, index, 'floor'], message: 'Floor must exist in this map.' })
      }
    }
  }
  const rooms = new Map(map.rooms.map(room => [room.id, room]))
  for (const [index, corridor] of map.corridors.entries()) {
    const from = rooms.get(corridor.fromRoomId)
    const to = rooms.get(corridor.toRoomId)
    if (from && to && (from.floor ?? 0) !== (to.floor ?? 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['corridors', index], message: 'Corridors must connect rooms on the same floor.' })
    }
  }
  for (const [index, stair] of (map.stairs ?? []).entries()) {
    const from = rooms.get(stair.fromRoomId)
    const to = rooms.get(stair.toRoomId)
    const containsLanding = (room: z.infer<typeof dungeonMapRoomSchema>) => stair.x >= room.x && stair.x + (stair.width ?? 1) <= room.x + room.width
      && stair.y >= room.y && stair.y + (stair.height ?? 1) <= room.y + room.height
    if (!from || !to || (to.floor ?? 0) - (from.floor ?? 0) !== 1 || !containsLanding(from) || !containsLanding(to)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stairs', index], message: 'The entire stair footprint must fit inside rooms on adjacent floors.' })
    }
  }
  for (const [index, portal] of (map.portals ?? []).entries()) {
    const room = rooms.get(portal.roomId)
    const start = portal.points[0]!
    const end = portal.points.at(-1)!
    const startsAtWall = room && start.x >= room.x && start.x < room.x + room.width
      && start.y >= room.y && start.y < room.y + room.height
      && (start.x === room.x || start.x === room.x + room.width - 1 || start.y === room.y || start.y === room.y + room.height - 1)
    const reachesBoundary = end.x === 0 || end.x === map.width - 1 || end.y === 0 || end.y === map.height - 1
    const validPath = portal.points.every((point, pointIndex) => point.x < map.width && point.y < map.height
      && (pointIndex === 0 || point.x === portal.points[pointIndex - 1]!.x || point.y === portal.points[pointIndex - 1]!.y))
    if (!startsAtWall || !reachesBoundary || !validPath) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['portals', index], message: 'An entrance or exit must connect a room wall to the map boundary with an orthogonal path.' })
    }
  }
  if (map.flow) {
    const flow = map.flow
    const route = flow.routeRoomIds
    const edges = new Map(map.rooms.map(room => [room.id, new Set<string>()]))
    for (const edge of [...map.corridors, ...(map.stairs ?? [])]) {
      edges.get(edge.fromRoomId)?.add(edge.toRoomId)
      edges.get(edge.toRoomId)?.add(edge.fromRoomId)
    }
    const validRoute = route.every((id, index) => rooms.has(id) && !rooms.get(id)!.isSecret
      && (index === 0 || edges.get(route[index - 1]!)?.has(id)))
    const entrance = map.portals?.some(portal => portal.kind === 'ENTRANCE' && portal.roomId === flow.entryRoomId && !portal.isSecret)
    const exit = map.portals?.some(portal => portal.kind === 'EXIT' && portal.roomId === flow.exitRoomId && !portal.isSecret)
    if (!validRoute || !entrance || !exit || route[0] !== flow.entryRoomId || route.at(-1) !== flow.exitRoomId
      || !route.includes(flow.objectiveRoomId) || new Set([flow.entryRoomId, flow.objectiveRoomId, flow.exitRoomId]).size !== 3) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['flow'], message: 'The encounter route must connect its entrance, objective, and exit through visible rooms and actual passages or stairs.' })
    }
  }
  for (const [index, feature] of (map.terrain ?? []).entries()) {
    if (feature.x + feature.width > map.width || feature.y + feature.height > map.height) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['terrain', index], message: 'Terrain must fit inside the map.' })
    }
    if (feature.roomId) {
      const room = rooms.get(feature.roomId)
      if (!room || (feature.floor ?? 0) !== (room.floor ?? 0)
        || feature.x < room.x || feature.y < room.y
        || feature.x + feature.width > room.x + room.width || feature.y + feature.height > room.y + room.height) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['terrain', index],
          message: 'Room-owned terrain must fit inside its room on the same floor.',
        })
      }
    }
  }
})

export const dungeonCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  theme: z.string().trim().min(1).max(80).default('ruins'),
  seed: z.string().trim().min(1).max(80).optional(),
  config: dungeonGeneratorConfigSchema.optional(),
})

export const dungeonUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    status: campaignDungeonStatusSchema.optional(),
    theme: z.string().trim().min(1).max(80).optional(),
    seed: z.string().trim().min(1).max(80).optional(),
    config: dungeonGeneratorConfigSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
    path: ['name'],
  })

export const dungeonGenerateSchema = z.object({
  seed: z.string().trim().min(1).max(80).optional(),
  config: dungeonGeneratorConfigSchema.optional(),
})

export const dungeonRegenerateSchema = z.object({
  scope: campaignDungeonRegenerateScopeSchema.default('FULL'),
  preserveLocks: z.boolean().default(true),
  seed: z.string().trim().min(1).max(80).optional(),
  config: dungeonGeneratorConfigSchema.optional(),
}).refine(value => !value.config || value.scope === 'FULL' || value.scope === 'LAYOUT', {
  message: 'Generator settings can only be applied during full or layout regeneration.',
  path: ['config'],
})

export const dungeonListQuerySchema = z.object({
  status: campaignDungeonStatusSchema.optional(),
  theme: z.string().trim().min(1).max(80).optional(),
})

export const dungeonRoomUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(10000).optional().nullable(),
    gmNotes: z.string().max(10000).optional().nullable(),
    playerNotes: z.string().max(10000).optional().nullable(),
    readAloud: z.string().max(10000).optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    state: dungeonRoomStateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
    path: ['name'],
  })

export const dungeonMapPatchActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ADD_ROOM'),
    floor: dungeonFloorSchema.optional(),
    roomNumber: z.number().int().positive().optional(),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    width: z.number().int().min(2).max(80),
    height: z.number().int().min(2).max(80),
    isSecret: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('MOVE_ROOM'),
    roomId: z.string().min(1),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
  }),
  z.object({
    type: z.literal('RESIZE_ROOM'),
    roomId: z.string().min(1),
    width: z.number().int().min(2).max(80),
    height: z.number().int().min(2).max(80),
  }),
  z.object({
    type: z.literal('REMOVE_ROOM'),
    roomId: z.string().min(1),
  }),
  z.object({
    type: z.literal('ADD_CORRIDOR'),
    fromRoomId: z.string().min(1),
    toRoomId: z.string().min(1),
    points: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(2),
  }),
  z.object({
    type: z.literal('REMOVE_CORRIDOR'),
    corridorId: z.string().min(1),
  }),
  z.object({
    type: z.literal('ADD_DOOR'),
    corridorId: z.string().min(1),
    x: z.number().int(),
    y: z.number().int(),
    isLocked: z.boolean().default(false),
    isSecret: z.boolean().default(false),
    isSpecial: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('MOVE_DOOR'),
    doorId: z.string().min(1),
    x: z.number().int(),
    y: z.number().int(),
  }),
  z.object({
    type: z.literal('REMOVE_DOOR'),
    doorId: z.string().min(1),
  }),
  z.object({
    type: z.literal('TOGGLE_DOOR_SECRET'),
    doorId: z.string().min(1),
  }),
  z.object({
    type: z.literal('TOGGLE_DOOR_LOCK'),
    doorId: z.string().min(1),
  }),
  z.object({
    type: z.literal('DRAW_WALL_SEGMENT'),
    floor: dungeonFloorSchema.optional(),
    x1: z.number().int(),
    y1: z.number().int(),
    x2: z.number().int(),
    y2: z.number().int(),
  }),
  z.object({
    type: z.literal('ERASE_WALL_SEGMENT'),
    wallId: z.string().min(1),
  }),
  z.object({
    type: z.literal('RENUMBER_ROOMS'),
    mode: z.enum(['AUTO', 'EXPLICIT']).default('AUTO'),
    roomOrder: z.array(z.string().min(1)).max(500).optional(),
  }),
  z.object({
    type: z.literal('PAINT_ZONE'),
    floor: dungeonFloorSchema.optional(),
    zoneType: dungeonZoneTypeSchema,
    label: z.string().trim().min(1).max(100),
    cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1).max(5000),
  }),
  z.object({
    type: z.literal('CLEAR_ZONE'),
    zoneId: z.string().min(1),
  }),
  z.object({
    type: z.literal('TOGGLE_LOCK'),
    entityType: z.enum(['DOOR', 'TRAP', 'ENCOUNTER', 'TREASURE', 'DRESSING']),
    entityId: z.string().min(1),
  }),
])

export const dungeonMapPatchSchema = z.object({
  actions: z.array(dungeonMapPatchActionSchema).min(1).max(100),
})

export const dungeonLinkCreateSchema = z.object({
  roomId: z.string().min(1).optional(),
  linkType: dungeonLinkTypeSchema,
  targetId: z.string().trim().min(1).max(120),
})

export const dungeonSnapshotCreateSchema = z.object({
  snapshotType: campaignDungeonSnapshotTypeSchema.default('MANUAL'),
})

export const dungeonExportSchema = z.object({
  floor: dungeonFloorSchema.optional(),
  format: dungeonExportFormatSchema.default('JSON'),
  playerSafe: z.boolean().default(false),
  includeGrid: z.boolean().default(true),
  includeLabels: z.boolean().default(true),
  includeGmLayer: z.boolean().default(true),
})

export const dungeonImportSchema = z.object({
  source: z
    .object({
      schemaVersion: z.literal(1),
      exportedAt: z.string().min(1),
      source: z.object({
        dungeonId: z.string().min(1),
        campaignId: z.string().min(1),
      }),
      dungeon: z.object({
        name: z.string().trim().min(1).max(200),
        status: campaignDungeonStatusSchema,
        theme: z.string().trim().min(1).max(80),
        seed: z.string().trim().min(1).max(80),
        gridType: campaignDungeonGridTypeSchema,
        generatorVersion: z.string().min(1),
        config: dungeonGeneratorConfigSchema,
        map: dungeonMapSchema,
        playerView: z.record(z.string(), z.unknown()).nullable(),
      }),
      rooms: z.array(
        z.object({
          id: z.string().min(1).optional(),
          roomNumber: z.number().int().positive(),
          name: z.string().trim().min(1).max(200),
          description: z.string().max(10000).nullable(),
          gmNotes: z.string().max(10000).nullable(),
          playerNotes: z.string().max(10000).nullable(),
          readAloud: z.string().max(10000).nullable(),
          tags: z.array(z.string().max(60)).max(30),
          state: dungeonRoomStateSchema,
          bounds: z
            .object({
              x: z.number().int(),
              y: z.number().int(),
              width: z.number().int().positive(),
              height: z.number().int().positive(),
              floor: dungeonFloorSchema.optional(),
            })
            .nullable(),
        }),
      ),
      links: z.array(
        z.object({
          roomId: z.string().min(1).nullable(),
          linkType: dungeonLinkTypeSchema,
          targetId: z.string().trim().min(1).max(120),
        }),
      ),
    })
    .strict(),
  nameOverride: z.string().trim().min(1).max(200).optional(),
})

export const dungeonPublishSchema = z.object({
  status: z.enum(['READY', 'DRAFT']),
})

export type DungeonCreateInput = z.infer<typeof dungeonCreateSchema>
export type DungeonUpdateInput = z.infer<typeof dungeonUpdateSchema>
export type DungeonGenerateInput = z.infer<typeof dungeonGenerateSchema>
export type DungeonRegenerateInput = z.infer<typeof dungeonRegenerateSchema>
export type DungeonListQueryInput = z.infer<typeof dungeonListQuerySchema>
export type DungeonGeneratorConfigInput = z.infer<typeof dungeonGeneratorConfigSchema>
export type DungeonRoomUpdateInput = z.infer<typeof dungeonRoomUpdateSchema>
export type DungeonMapPatchInput = z.infer<typeof dungeonMapPatchSchema>
export type DungeonMapPatchActionInput = z.infer<typeof dungeonMapPatchActionSchema>
export type DungeonLinkCreateInput = z.infer<typeof dungeonLinkCreateSchema>
export type DungeonSnapshotCreateInput = z.infer<typeof dungeonSnapshotCreateSchema>
export type DungeonExportInput = z.infer<typeof dungeonExportSchema>
export type DungeonImportInput = z.infer<typeof dungeonImportSchema>
export type DungeonPublishInput = z.infer<typeof dungeonPublishSchema>
