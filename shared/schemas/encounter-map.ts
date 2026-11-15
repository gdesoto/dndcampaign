import { z } from 'zod'

export const campaignEncounterMapStatusSchema = z.enum(['DRAFT', 'READY', 'ARCHIVED'])
export const campaignEncounterMapGridTypeSchema = z.enum(['SQUARE'])
export const encounterMapTypeSchema = z.enum(['DUNGEON', 'BUILDING', 'FOREST'])
const encounterMapFloorSchema = z.number().int().min(0).max(3)
export const campaignEncounterMapRegenerateScopeSchema = z.enum([
  'FULL',
  'LAYOUT',
  'DOORS',
  'TRAPS',
  'ENCOUNTERS',
  'TREASURE',
])
export const campaignEncounterMapSnapshotTypeSchema = z.enum(['AUTO', 'MANUAL', 'PRE_REGENERATE'])
export const encounterMapExportFormatSchema = z.enum(['JSON', 'SVG', 'PNG', 'PDF'])
export const encounterMapLinkTypeSchema = z.enum(['SESSION', 'QUEST', 'MILESTONE', 'GLOSSARY', 'ENCOUNTER'])
export const encounterMapRoomStateSchema = z.enum(['UNSEEN', 'EXPLORED', 'CLEARED', 'CONTESTED'])
export const encounterMapZoneTypeSchema = z.enum(['SAFE', 'HAZARD', 'FACTION'])
export const encounterMapDifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD', 'DEADLY'])
export const encounterMapTrapSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH'])
export const encounterMapTreasureCategorySchema = z.enum(['COIN', 'ITEM', 'ART', 'MAGIC'])
export const encounterMapTreasureRaritySchema = z.enum(['COMMON', 'UNCOMMON', 'RARE', 'VERY_RARE'])

export const encounterMapEncounterFlowSchema = z.enum(['LINEAR', 'BRANCHING', 'LOOP'])
export const encounterMapEncounterScaleSchema = z.enum(['SINGLE', 'SEQUENCE', 'COMPLEX'])
export const encounterMapBuildingTypeSchema = z.enum(['MANOR', 'TAVERN', 'TEMPLE', 'THEATER', 'LABORATORY'])

export const encounterMapAccessPointsConfigSchema = z.object({
  entrances: z.number().int().min(1).max(3).default(1),
  exits: z.number().int().min(1).max(2).default(1),
  entranceSide: z.enum(['AUTO', 'NORTH', 'EAST', 'SOUTH', 'WEST']).default('AUTO'),
  concealedEntrance: z.boolean().default(false),
})

export const encounterMapTacticalTerrainConfigSchema = z.object({
  cover: z.enum(['NONE', 'LIGHT', 'HEAVY']).default('LIGHT'),
  elevation: z.boolean().default(false),
  difficultTerrain: z.boolean().default(false),
  hazards: z.boolean().default(false),
  sightlines: z.enum(['OPEN', 'MIXED', 'BROKEN']).default('MIXED'),
})

export const encounterMapVerticalConnectionsConfigSchema = z.object({
  basement: z.boolean().default(false),
  staircases: z.enum(['SINGLE', 'DUAL']).default('SINGLE'),
  ladders: z.boolean().default(false),
  balconies: z.boolean().default(false),
  bridges: z.boolean().default(false),
})

export const encounterMapLayoutConfigSchema = z.object({
  roomDensity: z.number().min(0.02).max(0.8).default(0.25),
  minRoomSize: z.number().int().min(3).max(24).default(4),
  maxRoomSize: z.number().int().min(4).max(36).default(10),
  corridorStyle: z.enum(['STRAIGHT', 'WINDING', 'MIXED']).default('MIXED'),
  connectivityStrictness: z.number().min(0).max(1).default(0.7),
  secretRoomChance: z.number().min(0).max(1).default(0.1),
})

export const encounterMapDoorConfigSchema = z.object({
  doorFrequency: z.number().min(0).max(1).default(0.65),
  lockedDoorChance: z.number().min(0).max(1).default(0.2),
  secretDoorChance: z.number().min(0).max(1).default(0.08),
  specialDoorChance: z.number().min(0).max(1).default(0.05),
})

export const encounterMapContentConfigSchema = z.object({
  trapDensity: z.number().min(0).max(1).default(0.15),
  encounterDensity: z.number().min(0).max(1).default(0.3),
  treasureDensity: z.number().min(0).max(1).default(0.2),
  dressingDensity: z.number().min(0).max(1).default(0.35),
})

export const encounterMapGeneratorConfigSchema = z
  .object({
    mapType: encounterMapTypeSchema.default('DUNGEON'),
    floorCount: z.number().int().min(1).max(4).default(1),
    buildingType: encounterMapBuildingTypeSchema.default('MANOR'),
    encounterFlow: encounterMapEncounterFlowSchema.default('BRANCHING'),
    encounterScale: encounterMapEncounterScaleSchema.default('SEQUENCE'),
    accessPoints: encounterMapAccessPointsConfigSchema.prefault({}),
    tacticalTerrain: encounterMapTacticalTerrainConfigSchema.prefault({}),
    verticalConnections: encounterMapVerticalConnectionsConfigSchema.prefault({}),
    gridType: campaignEncounterMapGridTypeSchema.default('SQUARE'),
    width: z.number().int().min(20).max(400).default(40),
    height: z.number().int().min(20).max(400).default(40),
    cellSize: z.number().int().min(16).max(128).default(32),
    theme: z.string().trim().min(1).max(80).default('ruins'),
    layout: encounterMapLayoutConfigSchema.prefault({}),
    doors: encounterMapDoorConfigSchema.prefault({}),
    content: encounterMapContentConfigSchema.prefault({}),
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

export const encounterMapRoomSchema = z.object({
  id: z.string().min(1),
  roomNumber: z.number().int().positive(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  isSecret: z.boolean().default(false),
  floor: encounterMapFloorSchema.optional(),
  label: z.string().trim().min(1).max(100).optional(),
  kind: z.enum(['ROOM', 'HALL', 'STAIRWELL', 'CLEARING', 'BALCONY']).optional(),
})

export const encounterMapCorridorSchema = z.object({
  id: z.string().min(1),
  fromRoomId: z.string().min(1),
  toRoomId: z.string().min(1),
  points: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(2),
  kind: z.enum(['PASSAGE', 'BRIDGE']).optional(),
})

export const encounterMapDoorSchema = z.object({
  id: z.string().min(1),
  x: z.number().int(),
  y: z.number().int(),
  corridorId: z.string().min(1),
  isLocked: z.boolean().default(false),
  isSecret: z.boolean().default(false),
  isSpecial: z.boolean().default(false),
})

export const encounterMapWallSegmentSchema = z.object({
  id: z.string().min(1),
  x1: z.number().int(),
  y1: z.number().int(),
  x2: z.number().int(),
  y2: z.number().int(),
  floor: encounterMapFloorSchema.optional(),
})

export const encounterMapTerrainFeatureSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['TREE', 'ROCK', 'BRUSH', 'COVER', 'ELEVATION', 'DIFFICULT', 'HAZARD']),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  floor: encounterMapFloorSchema.optional(),
  roomId: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(100).optional(),
  elevationFeet: z.number().min(0).max(100).optional(),
  blocksMovement: z.boolean().optional(),
  blocksSight: z.boolean().optional(),
})

export const encounterMapStairSchema = z.object({
  id: z.string().min(1),
  fromRoomId: z.string().min(1),
  toRoomId: z.string().min(1),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  kind: z.enum(['STAIRS', 'LADDER']).optional(),
})

export const encounterMapPortalSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['ENTRANCE', 'EXIT']),
  roomId: z.string().min(1),
  points: z.array(z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() })).min(2),
  isSecret: z.boolean().optional(),
  label: z.string().trim().min(1).max(100).optional(),
})

export const encounterMapFlowPlanSchema = z.object({
  style: encounterMapEncounterFlowSchema,
  entryRoomId: z.string().min(1),
  objectiveRoomId: z.string().min(1),
  exitRoomId: z.string().min(1),
  routeRoomIds: z.array(z.string().min(1)).min(3).max(5000),
})

export const encounterMapTrapSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  severity: encounterMapTrapSeveritySchema,
  trigger: z.string().trim().min(1).max(500),
  effect: z.string().trim().min(1).max(500),
  detectDc: z.number().int().min(1).max(40),
  disarmDc: z.number().int().min(1).max(40),
  isLocked: z.boolean().default(false),
})

export const encounterMapEncounterSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  difficulty: encounterMapDifficultySchema,
  summary: z.string().trim().min(1).max(500),
  isLocked: z.boolean().default(false),
})

export const encounterMapTreasureSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  category: encounterMapTreasureCategorySchema,
  rarity: encounterMapTreasureRaritySchema,
  summary: z.string().trim().min(1).max(500),
  isLocked: z.boolean().default(false),
})

export const encounterMapDressingSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  text: z.string().trim().min(1).max(500),
  isLocked: z.boolean().default(false),
})

export const encounterMapZoneSchema = z.object({
  id: z.string().min(1),
  type: encounterMapZoneTypeSchema,
  label: z.string().trim().min(1).max(100),
  cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1).max(5000),
  floor: encounterMapFloorSchema.optional(),
})

export const encounterMapPassHistoryEntrySchema = z.object({
  pass: z.enum(['LAYOUT', 'DOORS', 'TRAPS', 'ENCOUNTERS', 'TREASURE', 'DRESSING']),
  scope: campaignEncounterMapRegenerateScopeSchema,
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

export const encounterMapSchema = z.object({
  schemaVersion: z.literal(1),
  mapType: encounterMapTypeSchema.optional(),
  floorCount: z.number().int().min(1).max(4).optional(),
  floorLabels: z.array(z.string().trim().min(1).max(100)).optional(),
  gridType: campaignEncounterMapGridTypeSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  cellSize: z.number().int().positive(),
  rooms: z.array(encounterMapRoomSchema),
  corridors: z.array(encounterMapCorridorSchema),
  doors: z.array(encounterMapDoorSchema),
  walls: z.array(encounterMapWallSegmentSchema).default([]),
  traps: z.array(encounterMapTrapSchema).default([]),
  encounters: z.array(encounterMapEncounterSchema).default([]),
  treasures: z.array(encounterMapTreasureSchema).default([]),
  dressing: z.array(encounterMapDressingSchema).default([]),
  zones: z.array(encounterMapZoneSchema).default([]),
  terrain: z.array(encounterMapTerrainFeatureSchema).optional(),
  stairs: z.array(encounterMapStairSchema).optional(),
  portals: z.array(encounterMapPortalSchema).optional(),
  flow: encounterMapFlowPlanSchema.optional(),
  metadata: z.object({
    algorithmVersion: z.string().min(1),
    configHash: z.string().min(1),
    generatedAt: z.string().min(1),
    seed: z.string().min(1),
    passHistory: z.array(encounterMapPassHistoryEntrySchema).default([]),
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
    const containsLanding = (room: z.infer<typeof encounterMapRoomSchema>) => stair.x >= room.x && stair.x + (stair.width ?? 1) <= room.x + room.width
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

export const encounterMapCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  theme: z.string().trim().min(1).max(80).default('ruins'),
  seed: z.string().trim().min(1).max(80).optional(),
  config: encounterMapGeneratorConfigSchema.optional(),
})

export const encounterMapUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    status: campaignEncounterMapStatusSchema.optional(),
    theme: z.string().trim().min(1).max(80).optional(),
    seed: z.string().trim().min(1).max(80).optional(),
    config: encounterMapGeneratorConfigSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
    path: ['name'],
  })

export const encounterMapGenerateSchema = z.object({
  seed: z.string().trim().min(1).max(80).optional(),
  config: encounterMapGeneratorConfigSchema.optional(),
})

export const encounterMapRegenerateSchema = z.object({
  scope: campaignEncounterMapRegenerateScopeSchema.default('FULL'),
  preserveLocks: z.boolean().default(true),
  seed: z.string().trim().min(1).max(80).optional(),
  config: encounterMapGeneratorConfigSchema.optional(),
}).refine(value => !value.config || value.scope === 'FULL' || value.scope === 'LAYOUT', {
  message: 'Generator settings can only be applied during full or layout regeneration.',
  path: ['config'],
})

export const encounterMapListQuerySchema = z.object({
  status: campaignEncounterMapStatusSchema.optional(),
  theme: z.string().trim().min(1).max(80).optional(),
})

export const encounterMapRoomUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(10000).optional().nullable(),
    gmNotes: z.string().max(10000).optional().nullable(),
    playerNotes: z.string().max(10000).optional().nullable(),
    readAloud: z.string().max(10000).optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    state: encounterMapRoomStateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
    path: ['name'],
  })

export const encounterMapPatchActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ADD_ROOM'),
    floor: encounterMapFloorSchema.optional(),
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
    floor: encounterMapFloorSchema.optional(),
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
    floor: encounterMapFloorSchema.optional(),
    zoneType: encounterMapZoneTypeSchema,
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

export const encounterMapPatchSchema = z.object({
  actions: z.array(encounterMapPatchActionSchema).min(1).max(100),
})

export const encounterMapLinkCreateSchema = z.object({
  roomId: z.string().min(1).optional(),
  linkType: encounterMapLinkTypeSchema,
  targetId: z.string().trim().min(1).max(120),
})

export const encounterMapSnapshotLabelSchema = z.string().trim().min(1).max(80)

export const encounterMapSnapshotCreateSchema = z.object({
  snapshotType: campaignEncounterMapSnapshotTypeSchema.default('MANUAL'),
  label: encounterMapSnapshotLabelSchema.optional(),
})

export const encounterMapSnapshotUpdateSchema = z.object({
  label: encounterMapSnapshotLabelSchema.nullable(),
})

export const encounterMapSnapshotListQuerySchema = z.object({
  include: z.enum(['map']).optional(),
})

export const encounterMapExportSchema = z.object({
  floor: encounterMapFloorSchema.optional(),
  format: encounterMapExportFormatSchema.default('JSON'),
  playerSafe: z.boolean().default(false),
  includeGrid: z.boolean().default(true),
  includeLabels: z.boolean().default(true),
  includeGmLayer: z.boolean().default(true),
})

export const encounterMapImportSchema = z.object({
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
        status: campaignEncounterMapStatusSchema,
        theme: z.string().trim().min(1).max(80),
        seed: z.string().trim().min(1).max(80),
        gridType: campaignEncounterMapGridTypeSchema,
        generatorVersion: z.string().min(1),
        config: encounterMapGeneratorConfigSchema,
        map: encounterMapSchema,
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
          state: encounterMapRoomStateSchema,
          bounds: z
            .object({
              x: z.number().int(),
              y: z.number().int(),
              width: z.number().int().positive(),
              height: z.number().int().positive(),
              floor: encounterMapFloorSchema.optional(),
            })
            .nullable(),
        }),
      ),
      links: z.array(
        z.object({
          roomId: z.string().min(1).nullable(),
          linkType: encounterMapLinkTypeSchema,
          targetId: z.string().trim().min(1).max(120),
        }),
      ),
    })
    .strict(),
  nameOverride: z.string().trim().min(1).max(200).optional(),
})

export type EncounterMapCreateInput = z.infer<typeof encounterMapCreateSchema>
export type EncounterMapUpdateInput = z.infer<typeof encounterMapUpdateSchema>
export type EncounterMapGenerateInput = z.infer<typeof encounterMapGenerateSchema>
export type EncounterMapRegenerateInput = z.infer<typeof encounterMapRegenerateSchema>
export type EncounterMapListQueryInput = z.infer<typeof encounterMapListQuerySchema>
export type EncounterMapGeneratorConfigInput = z.infer<typeof encounterMapGeneratorConfigSchema>
export type EncounterMapRoomUpdateInput = z.infer<typeof encounterMapRoomUpdateSchema>
export type EncounterMapPatchInput = z.infer<typeof encounterMapPatchSchema>
export type EncounterMapPatchActionInput = z.infer<typeof encounterMapPatchActionSchema>
export type EncounterMapLinkCreateInput = z.infer<typeof encounterMapLinkCreateSchema>
export type EncounterMapSnapshotCreateInput = z.infer<typeof encounterMapSnapshotCreateSchema>
export type EncounterMapSnapshotUpdateInput = z.infer<typeof encounterMapSnapshotUpdateSchema>
export type EncounterMapExportInput = z.infer<typeof encounterMapExportSchema>
export type EncounterMapImportInput = z.infer<typeof encounterMapImportSchema>
