import { describe, expect, it } from 'vitest'
import { dungeonExportSchema, dungeonGeneratorConfigSchema, dungeonMapPatchSchema, dungeonMapSchema } from '../../shared/schemas/dungeon'
import type { DungeonMapData } from '../../shared/types/dungeon'
import { DungeonGeneratorService } from '../../server/services/dungeon/dungeon-generator.service'

const inside = (point: { x: number; y: number }, room: DungeonMapData['rooms'][number]) =>
  point.x >= room.x && point.x < room.x + room.width && point.y >= room.y && point.y < room.y + room.height

const assertPlayableMap = (map: DungeonMapData) => {
  const roomById = new Map(map.rooms.map(room => [room.id, room]))
  const walkable = new Set<string>()
  const protectedPaths = new Set<string>()
  const key = (x: number, y: number, floor: number) => `${floor}:${x}:${y}`
  const roomEdges = new Map(map.rooms.map(room => [room.id, new Set<string>()]))
  const stairsByCell = new Map<string, string[]>()

  for (const room of map.rooms) {
    const floor = room.floor ?? 0
    expect(room.x).toBeGreaterThanOrEqual(0)
    expect(room.y).toBeGreaterThanOrEqual(0)
    expect(room.x + room.width).toBeLessThanOrEqual(map.width)
    expect(room.y + room.height).toBeLessThanOrEqual(map.height)
    expect(floor).toBeLessThan(map.floorCount ?? 1)
    expect(room.label).toBeTruthy()
    for (const other of map.rooms) {
      if (room.id === other.id || floor !== (other.floor ?? 0)) continue
      const overlap = room.x < other.x + other.width && room.x + room.width > other.x
        && room.y < other.y + other.height && room.y + room.height > other.y
      expect(overlap, `${room.id} overlaps ${other.id}`).toBe(false)
    }
    for (let x = room.x; x < room.x + room.width; x += 1) {
      for (let y = room.y; y < room.y + room.height; y += 1) walkable.add(key(x, y, floor))
    }
  }
  expect(new Set(map.rooms.map(room => room.roomNumber)).size).toBe(map.rooms.length)

  for (const corridor of map.corridors) {
    const from = roomById.get(corridor.fromRoomId)!
    const to = roomById.get(corridor.toRoomId)!
    expect(from).toBeDefined()
    expect(to).toBeDefined()
    expect(from.floor ?? 0).toBe(to.floor ?? 0)
    expect(inside(corridor.points[0]!, from)).toBe(true)
    expect(inside(corridor.points.at(-1)!, to)).toBe(true)
    roomEdges.get(from.id)!.add(to.id)
    roomEdges.get(to.id)!.add(from.id)
    for (let index = 1; index < corridor.points.length; index += 1) {
      const start = corridor.points[index - 1]!
      const end = corridor.points[index]!
      expect(start.x === end.x || start.y === end.y).toBe(true)
      const distance = Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
      for (let step = 0; step <= distance; step += 1) {
        const x = start.x + Math.sign(end.x - start.x) * step
        const y = start.y + Math.sign(end.y - start.y) * step
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThan(map.width)
        expect(y).toBeLessThan(map.height)
        walkable.add(key(x, y, from.floor ?? 0))
        protectedPaths.add(key(x, y, from.floor ?? 0))
        if (map.mapType !== 'FOREST') {
          expect(map.rooms.some(room => room.id !== from.id && room.id !== to.id
            && (room.floor ?? 0) === (from.floor ?? 0) && inside({ x, y }, room))).toBe(false)
        }
      }
    }
  }

  for (const stair of map.stairs ?? []) {
    const from = roomById.get(stair.fromRoomId)!
    const to = roomById.get(stair.toRoomId)!
    expect(inside(stair, from)).toBe(true)
    expect(inside(stair, to)).toBe(true)
    expect((to.floor ?? 0) - (from.floor ?? 0)).toBe(1)
    if (stair.width && stair.height) {
      if (stair.kind !== 'LADDER') {
        expect(from.kind).toBe('STAIRWELL')
        expect(to.kind).toBe('STAIRWELL')
      }
      expect(inside({ x: stair.x + stair.width - 1, y: stair.y + stair.height - 1 }, from)).toBe(true)
      expect(inside({ x: stair.x + stair.width - 1, y: stair.y + stair.height - 1 }, to)).toBe(true)
    }
    roomEdges.get(from.id)!.add(to.id)
    roomEdges.get(to.id)!.add(from.id)
    const lower = key(stair.x, stair.y, from.floor ?? 0)
    const upper = key(stair.x, stair.y, to.floor ?? 0)
    stairsByCell.set(lower, [...(stairsByCell.get(lower) ?? []), upper])
    stairsByCell.set(upper, [...(stairsByCell.get(upper) ?? []), lower])
    for (let x = stair.x; x < stair.x + (stair.width ?? 1); x += 1) {
      for (let y = stair.y; y < stair.y + (stair.height ?? 1); y += 1) {
        protectedPaths.add(key(x, y, from.floor ?? 0))
        protectedPaths.add(key(x, y, to.floor ?? 0))
      }
    }
  }

  for (const portal of map.portals ?? []) {
    const room = roomById.get(portal.roomId)!
    expect(room).toBeDefined()
    expect(room.isSecret).toBe(false)
    const first = portal.points[0]!
    const last = portal.points.at(-1)!
    expect(inside(first, room)).toBe(true)
    expect(first.x === room.x || first.x === room.x + room.width - 1 || first.y === room.y || first.y === room.y + room.height - 1).toBe(true)
    expect(last.x === 0 || last.x === map.width - 1 || last.y === 0 || last.y === map.height - 1).toBe(true)
    for (let index = 1; index < portal.points.length; index += 1) {
      const start = portal.points[index - 1]!
      const end = portal.points[index]!
      expect(start.x === end.x || start.y === end.y).toBe(true)
      const distance = Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
      for (let step = 0; step <= distance; step += 1) {
        const point = { x: start.x + Math.sign(end.x - start.x) * step, y: start.y + Math.sign(end.y - start.y) * step }
        expect(point.x).toBeGreaterThanOrEqual(0)
        expect(point.y).toBeGreaterThanOrEqual(0)
        expect(point.x).toBeLessThan(map.width)
        expect(point.y).toBeLessThan(map.height)
        expect(map.rooms.some(other => other.id !== room.id && (other.floor ?? 0) === (room.floor ?? 0) && inside(point, other))).toBe(false)
        walkable.add(key(point.x, point.y, room.floor ?? 0))
        protectedPaths.add(key(point.x, point.y, room.floor ?? 0))
      }
    }
  }

  if (map.flow) {
    const { entryRoomId, objectiveRoomId, exitRoomId, routeRoomIds } = map.flow
    expect(new Set(routeRoomIds).size).toBeGreaterThanOrEqual(3)
    expect(routeRoomIds[0]).toBe(entryRoomId)
    expect(routeRoomIds.at(-1)).toBe(exitRoomId)
    expect(routeRoomIds).toContain(objectiveRoomId)
    expect(new Set([entryRoomId, objectiveRoomId, exitRoomId]).size).toBe(3)
    expect(map.portals!.find(portal => portal.kind === 'ENTRANCE')!.roomId).toBe(entryRoomId)
    expect(map.portals!.find(portal => portal.kind === 'EXIT')!.roomId).toBe(exitRoomId)
    for (const [index, id] of routeRoomIds.entries()) {
      expect(roomById.get(id)?.isSecret).toBe(false)
      if (index) expect(roomEdges.get(routeRoomIds[index - 1]!)!.has(id)).toBe(true)
    }
  }

  for (const feature of map.terrain ?? []) {
    expect(feature.x).toBeGreaterThanOrEqual(0)
    expect(feature.y).toBeGreaterThanOrEqual(0)
    expect(feature.x + feature.width).toBeLessThanOrEqual(map.width)
    expect(feature.y + feature.height).toBeLessThanOrEqual(map.height)
    if (feature.roomId) {
      const room = roomById.get(feature.roomId)!
      expect(room).toBeDefined()
      expect(feature.floor ?? 0).toBe(room.floor ?? 0)
      expect(inside(feature, room)).toBe(true)
      expect(inside({ x: feature.x + feature.width - 1, y: feature.y + feature.height - 1 }, room)).toBe(true)
    }
    for (let x = feature.x; x < feature.x + feature.width; x += 1) {
      for (let y = feature.y; y < feature.y + feature.height; y += 1) {
        if (feature.roomId) {
          if (feature.blocksMovement) {
            expect(protectedPaths.has(key(x, y, feature.floor ?? 0)), 'blocking terrain occupies a passage, access point, or vertical connection').toBe(false)
            walkable.delete(key(x, y, feature.floor ?? 0))
          }
        } else {
          expect(walkable.has(key(x, y, feature.floor ?? 0)), 'ambient terrain blocks a clearing or route').toBe(false)
        }
      }
    }
  }

  // Check both the declared graph and the actual rasterized floor. A reference
  // between two rooms alone does not prove that a usable passage joins them.
  const connectedRooms = new Set([map.rooms[0]!.id])
  for (const id of connectedRooms) {
    for (const neighbor of roomEdges.get(id)!) connectedRooms.add(neighbor)
  }
  expect(connectedRooms.size).toBe(map.rooms.length)
  const entrance = map.portals!.find(portal => portal.kind === 'ENTRANCE')!
  const start = entrance.points.at(-1)!
  const reached = new Set([key(start.x, start.y, roomById.get(entrance.roomId)!.floor ?? 0)])
  for (const cell of reached) {
    const [floor, x, y] = cell.split(':').map(Number) as [number, number, number]
    const neighbors = [key(x - 1, y, floor), key(x + 1, y, floor), key(x, y - 1, floor), key(x, y + 1, floor), ...(stairsByCell.get(cell) ?? [])]
    for (const neighbor of neighbors) if (walkable.has(neighbor)) reached.add(neighbor)
  }
  expect(reached.size).toBe(walkable.size)
}

describe('dungeon generator service', () => {
  const service = new DungeonGeneratorService()

  it('separates encounter scale from canvas size and places primary access on the selected world side', () => {
    for (const mapType of ['DUNGEON', 'FOREST'] as const) {
      const counts: number[] = []
      for (const encounterScale of ['SINGLE', 'SEQUENCE', 'COMPLEX'] as const) {
        const config = dungeonGeneratorConfigSchema.parse({ mapType, encounterScale, width: 60, height: 40, content: { encounterDensity: 1 } })
        const map = service.generateBaseMap('scale-check', config)
        const expanded = service.generateBaseMap('scale-check', { ...config, width: 120, height: 80 })
        counts.push(map.rooms.length)
        expect(expanded.rooms.length).toBe(map.rooms.length)
        if (encounterScale === 'SINGLE') {
          expect(map.rooms.length).toBeLessThanOrEqual(6)
          expect(map.encounters.map(encounter => encounter.roomId)).toEqual([map.flow!.objectiveRoomId])
        } else if (encounterScale === 'SEQUENCE') {
          expect(map.rooms.length).toBeGreaterThanOrEqual(6)
          expect(map.rooms.length).toBeLessThanOrEqual(12)
          expect(map.encounters.length).toBeGreaterThan(1)
        } else {
          expect(map.rooms.length).toBeGreaterThanOrEqual(18)
          expect(map.encounters.length).toBeGreaterThan(2)
        }
      }
      expect(counts[0]).toBeLessThan(counts[1]!)
      expect(counts[1]).toBeLessThan(counts[2]!)
      for (const entranceSide of ['NORTH', 'EAST', 'SOUTH', 'WEST'] as const) {
        for (const [width, height] of [[20, 20], [30, 80], [80, 30]]) {
          const config = dungeonGeneratorConfigSchema.parse({ mapType, width, height, accessPoints: { entranceSide } })
          const map = service.generateBaseMap('oriented-access', config)
          const end = map.portals!.find(portal => portal.kind === 'ENTRANCE')!.points.at(-1)!
          expect(entranceSide === 'NORTH' ? end.y === 0 : entranceSide === 'SOUTH' ? end.y === height! - 1
            : entranceSide === 'WEST' ? end.x === 0 : end.x === width! - 1).toBe(true)
          assertPlayableMap(map)
        }
      }
    }
    for (const mapType of ['DUNGEON', 'FOREST', 'BUILDING'] as const) {
      for (const encounterScale of ['SINGLE', 'COMPLEX'] as const) {
        const size = encounterScale === 'SINGLE' ? 20 : 60
        const config = dungeonGeneratorConfigSchema.parse({
          mapType, encounterScale, encounterFlow: 'LOOP', width: size, height: size,
          floorCount: mapType === 'BUILDING' ? 3 : 1,
          accessPoints: { entrances: 3, exits: 2, entranceSide: 'SOUTH', concealedEntrance: true },
          tacticalTerrain: { cover: 'HEAVY', elevation: true, difficultTerrain: true, hazards: true, sightlines: 'BROKEN' },
          verticalConnections: { bridges: true, ...(mapType === 'BUILDING' ? { basement: true, staircases: 'DUAL', ladders: true, balconies: true } : {}) },
          content: { encounterDensity: 1 },
        })
        const map = service.generateBaseMap('tactical-access', config)
        expect(dungeonMapSchema.safeParse(map).success).toBe(true)
        expect(map.portals!.filter(portal => portal.kind === 'ENTRANCE' && !portal.isSecret)).toHaveLength(3)
        expect(map.portals!.filter(portal => portal.kind === 'EXIT')).toHaveLength(2)
        expect(map.portals!.filter(portal => portal.isSecret)).toHaveLength(1)
        expect(map.corridors.some(corridor => corridor.kind === 'BRIDGE')).toBe(true)
        if (encounterScale === 'SINGLE') expect(map.encounters.map(encounter => encounter.roomId)).toEqual([map.flow!.objectiveRoomId])
        if (mapType === 'BUILDING') {
          expect(map.floorLabels).toHaveLength(3)
          expect(map.floorLabels!.slice(0, 2)).toEqual(['Basement', 'Ground floor'])
          expect(map.stairs!.filter(stair => stair.kind === 'LADDER')).toHaveLength(2)
        }
        assertPlayableMap(map)
      }
    }
  })

  it('plans distinct linear, branching and looped encounters with real entrances, objectives and exits', () => {
    for (const mapType of ['DUNGEON', 'FOREST'] as const) {
      for (const encounterFlow of ['LINEAR', 'BRANCHING', 'LOOP'] as const) {
        for (const [width, height] of [[20, 20], [50, 40], [20, 100]]) {
          const config = dungeonGeneratorConfigSchema.parse({ mapType, encounterFlow, width, height, layout: { secretRoomChance: 1 }, content: { encounterDensity: 1, treasureDensity: 1 } })
          const map = service.generateBaseMap(`flow-${width}`, config)
          expect(map.flow?.style).toBe(encounterFlow)
          expect(map.portals).toHaveLength(2)
          assertPlayableMap(map)
          const flow = map.flow!
          const main = new Set(flow.routeRoomIds)
          const neighbors = new Map(map.rooms.map(room => [room.id, new Set<string>()]))
          for (const edge of map.corridors) {
            neighbors.get(edge.fromRoomId)!.add(edge.toRoomId)
            neighbors.get(edge.toRoomId)!.add(edge.fromRoomId)
          }
          const challengeId = flow.routeRoomIds[1]!
          const withoutChallenge = new Set([flow.entryRoomId])
          for (const id of withoutChallenge) {
            for (const neighbor of neighbors.get(id)!) if (neighbor !== challengeId) withoutChallenge.add(neighbor)
          }
          expect(withoutChallenge.has(flow.objectiveRoomId)).toBe(encounterFlow === 'LOOP')
          if (encounterFlow === 'LINEAR') {
            expect(main.size).toBe(map.rooms.length)
            expect(map.corridors.length).toBe(map.rooms.length - 1)
          } else {
            expect(map.rooms.some(room => !main.has(room.id))).toBe(true)
          }
          expect(map.encounters.find(encounter => encounter.roomId === flow.objectiveRoomId)?.difficulty).toBe('HARD')
          expect(map.encounters.find(encounter => encounter.roomId === challengeId)?.difficulty).toBe('MEDIUM')
          expect(map.encounters.some(encounter => encounter.roomId === flow.entryRoomId || encounter.roomId === flow.exitRoomId)).toBe(false)
          expect(map.treasures.some(treasure => treasure.roomId === flow.objectiveRoomId)).toBe(true)
          const emptyContent = service.generateBaseMap('no-content', { ...config, content: { ...config.content, encounterDensity: 0, treasureDensity: 0 } })
          expect(emptyContent.encounters).toEqual([])
          expect(emptyContent.treasures).toEqual([])
          const regenerated = service.regenerate('ENCOUNTERS', 'reroll-content', config, map)
          expect(regenerated.flow).toEqual(map.flow)
          expect(regenerated.portals).toEqual(map.portals)
        }
      }
    }
    const building = service.generateBaseMap('guarded-stairs', dungeonGeneratorConfigSchema.parse({
      mapType: 'BUILDING', floorCount: 3,
      content: { encounterDensity: 0.01, trapDensity: 1 }, doors: { doorFrequency: 1, secretDoorChance: 1 },
    }))
    const approach = building.encounters.find(encounter => encounter.roomId !== building.flow!.objectiveRoomId && encounter.difficulty === 'MEDIUM')
    expect(approach).toBeDefined()
    expect(building.rooms.find(room => room.id === approach!.roomId)?.kind).toBe('HALL')
    expect(building.encounters.some(encounter => encounter.roomId === building.flow!.objectiveRoomId && encounter.difficulty === 'HARD')).toBe(true)
    expect(building.traps.every(trap => !['HALL', 'STAIRWELL'].includes(building.rooms.find(room => room.id === trap.roomId)!.kind!))).toBe(true)
    const primary = new Set(building.flow!.routeRoomIds)
    const criticalCorridorIds = new Set(building.corridors.filter(corridor => primary.has(corridor.fromRoomId) && primary.has(corridor.toRoomId)).map(corridor => corridor.id))
    expect(building.doors.filter(door => criticalCorridorIds.has(door.corridorId)).every(door => !door.isSecret)).toBe(true)
  })

  it('accepts legacy maps and validates encounter-map kinds, floors, and floor-scoped actions', () => {
    const legacyConfig = dungeonGeneratorConfigSchema.parse({})
    expect(legacyConfig).toMatchObject({ mapType: 'DUNGEON', floorCount: 1 })
    expect(dungeonGeneratorConfigSchema.safeParse({ mapType: 'FOREST', floorCount: 2 }).success).toBe(false)
    expect(dungeonGeneratorConfigSchema.safeParse({ mapType: 'BUILDING', floorCount: 5 }).success).toBe(false)
    expect(dungeonGeneratorConfigSchema.parse({ mapType: 'BUILDING', floorCount: 3 }).floorCount).toBe(3)
    expect(dungeonExportSchema.parse({ format: 'SVG', floor: 2 }).floor).toBe(2)
    expect(dungeonMapPatchSchema.parse({ actions: [{ type: 'ADD_ROOM', x: 2, y: 2, width: 4, height: 4, floor: 2 }] }).actions[0]).toHaveProperty('floor', 2)

    const generated = service.generateBaseMap('legacy', legacyConfig)
    const { mapType: _kind, floorCount: _floors, terrain: _terrain, stairs: _stairs, ...legacy } = generated
    expect(dungeonMapSchema.safeParse(legacy).success).toBe(true)
    expect(dungeonMapSchema.parse(generated)).toEqual(generated)
    const building = service.generateBaseMap('import-floors', dungeonGeneratorConfigSchema.parse({ mapType: 'BUILDING', floorCount: 3 }))
    expect(dungeonMapSchema.safeParse({ ...building, floorCount: 1 }).success).toBe(false)
    expect(dungeonMapSchema.safeParse({ ...building, stairs: [{ ...building.stairs![0], x: 0, y: 0 }] }).success).toBe(false)
    expect(dungeonMapSchema.safeParse({ ...building, corridors: [{ ...building.corridors[0], toRoomId: building.stairs![0]!.toRoomId }] }).success).toBe(false)
    expect(dungeonMapSchema.safeParse({ ...generated, terrain: [{ id: 'outside', kind: 'TREE', x: generated.width, y: 1, width: 2, height: 2 }] }).success).toBe(false)
  })

  it('builds connected, bounded maps with usable passages, aligned stairs, and clear forest paths across seeds and sizes', () => {
    for (const mapType of ['DUNGEON', 'BUILDING', 'FOREST'] as const) {
      for (const [width, height] of [[20, 20], [40, 32], [80, 60], [20, 100], [100, 20]]) {
        for (const seed of ['oak', 'stone', 'river']) {
          const config = dungeonGeneratorConfigSchema.parse({ mapType, width, height, floorCount: mapType === 'BUILDING' ? 3 : 1 })
          const map = service.generateBaseMap(seed, config)
          expect(map.mapType).toBe(mapType)
          expect(map.rooms.length).toBeGreaterThan(1)
          expect(map.stairs?.length ?? 0).toBe(mapType === 'BUILDING' ? 2 : 0)
          if (mapType === 'FOREST') {
            expect(map.terrain!.length).toBeGreaterThan(0)
            expect(map.doors).toEqual([])
          }
          assertPlayableMap(map)
          const repeat = service.generateBaseMap(seed, config)
          expect({ ...repeat, metadata: null }).toEqual({ ...map, metadata: null })
        }
      }
    }
    for (const mapType of ['DUNGEON', 'BUILDING', 'FOREST'] as const) {
      const config = dungeonGeneratorConfigSchema.parse({ mapType, width: 20, height: 20, layout: { minRoomSize: 24, maxRoomSize: 36, roomDensity: 0.8 } })
      assertPlayableMap(service.generateBaseMap('small-canvas-large-rooms', config))
    }
    const large = service.generateBaseMap('large-layout', dungeonGeneratorConfigSchema.parse({ width: 400, height: 400, encounterScale: 'COMPLEX' }))
    expect(large.rooms.length).toBeGreaterThanOrEqual(18)
    expect(dungeonMapSchema.safeParse(large).success).toBe(true)
  })

  it('produces deterministic output for same seed and config', () => {
    const config = dungeonGeneratorConfigSchema.parse({
      width: 60,
      height: 60,
      theme: 'crypt',
    })
    const first = service.generateBaseMap('seed-deterministic', config)
    const second = service.generateBaseMap('seed-deterministic', config)

    expect(second.metadata.configHash).toBe(first.metadata.configHash)
    expect(second.rooms).toEqual(first.rooms)
    expect(second.corridors).toEqual(first.corridors)
    expect(second.doors).toEqual(first.doors)
  })

  it('produces valid room and corridor references', () => {
    const config = dungeonGeneratorConfigSchema.parse({
      width: 80,
      height: 80,
      theme: 'ruins',
    })
    const map = service.generateBaseMap('seed-validity', config)
    const roomIds = new Set(map.rooms.map((room) => room.id))

    expect(map.rooms.length).toBeGreaterThan(1)
    expect(map.corridors.every((corridor) => roomIds.has(corridor.fromRoomId))).toBe(true)
    expect(map.corridors.every((corridor) => roomIds.has(corridor.toRoomId))).toBe(true)
    expect(map.doors.every((door) => map.corridors.some((corridor) => corridor.id === door.corridorId))).toBe(true)
  })

  it('records each regeneration scope with completion timestamps and retains the latest 60 passes', () => {
    const config = dungeonGeneratorConfigSchema.parse({})
    const base = service.generateBaseMap('history-base', config)
    const history = Array.from({ length: 60 }, (_, index) => ({ ...base.metadata.passHistory[0]!, seed: `history-${index}` }))
    const existing = { ...base, metadata: { ...base.metadata, passHistory: history } }
    for (const scope of ['DOORS', 'TRAPS', 'ENCOUNTERS', 'TREASURE', 'FULL', 'LAYOUT'] as const) {
      const regenerated = service.regenerate(scope, 'history-reroll', config, existing)
      const pass = regenerated.metadata.passHistory.at(-1)!
      expect(pass).toMatchObject({
        scope, pass: scope === 'FULL' ? 'LAYOUT' : scope, seed: 'history-reroll', configHash: regenerated.metadata.configHash,
      })
      expect(pass.startedAt).toBe(new Date(pass.startedAt).toISOString())
      expect(pass.finishedAt).toBe(new Date(pass.finishedAt).toISOString())
      expect(Date.parse(pass.startedAt)).toBeLessThanOrEqual(Date.parse(regenerated.metadata.generatedAt))
      expect(Date.parse(pass.finishedAt)).toBeGreaterThanOrEqual(Date.parse(regenerated.metadata.generatedAt))
      if (scope === 'FULL' || scope === 'LAYOUT') {
        expect(regenerated.metadata.passHistory.map(entry => entry.scope)).toEqual(['FULL', scope])
      } else {
        expect(regenerated.metadata.passHistory).toHaveLength(60)
        expect(regenerated.metadata.passHistory.slice(0, -1)).toEqual(history.slice(1))
      }
    }
    expect(existing.metadata.passHistory).toEqual(history)
  })

  it('supports scoped regeneration and preserves lock flags when enabled', () => {
    const config = dungeonGeneratorConfigSchema.parse({
      width: 90,
      height: 90,
      theme: 'ruins',
    })
    const base = service.generateBaseMap('seed-scoped', config)
    expect(base.doors.length).toBeGreaterThan(0)

    const edited = {
      ...base,
      doors: base.doors.map((door, index) =>
        index === 0
          ? {
            ...door,
            isLocked: true,
            isSecret: true,
            isSpecial: true,
          }
          : door,
      ),
    }

    const regeneratedPreserve = service.regenerate('DOORS', 'seed-scoped', config, edited, { preserveLocks: true })
    const regeneratedNoPreserve = service.regenerate('DOORS', 'seed-scoped', config, edited, { preserveLocks: false })

    expect(regeneratedPreserve.rooms).toEqual(edited.rooms)
    expect(regeneratedPreserve.corridors).toEqual(edited.corridors)

    const preservedDoor = regeneratedPreserve.doors.find((door) => door.id === edited.doors[0]?.id)
    expect(preservedDoor?.isLocked).toBe(true)
    expect(preservedDoor?.isSecret).toBe(true)
    expect(preservedDoor?.isSpecial).toBe(true)

    const nonPreservedDoor = regeneratedNoPreserve.doors.find((door) => door.id === edited.doors[0]?.id)
    expect(nonPreservedDoor?.isLocked && nonPreservedDoor?.isSecret && nonPreservedDoor?.isSpecial).toBe(false)

    const regenTraps = service.regenerate('TRAPS', 'seed-scoped', config, base, { preserveLocks: true })
    expect(regenTraps.rooms).toEqual(base.rooms)
    expect(regenTraps.corridors).toEqual(base.corridors)
    expect(regenTraps.doors).toEqual(base.doors)
    expect(regenTraps.metadata.passHistory.length).toBeGreaterThan(base.metadata.passHistory.length)

    // Old generators assigned sequence IDs. Preserve the authored content by
    // its room even when a new seed or density removes it from the random roll.
    const objectiveId = base.flow!.objectiveRoomId
    const lockedEncounter = { ...base.encounters.find(item => item.roomId === objectiveId)!, id: 'encounter-1', title: 'Authored guardian', isLocked: true }
    const secondLockedEncounter = { ...lockedEncounter, id: 'encounter-2', title: 'Authored reinforcements' }
    const lockedTreasure = { ...base.treasures.find(item => item.roomId === objectiveId)!, id: 'treasure-1', summary: 'Authored relic', isLocked: true }
    const secondLockedTreasure = { ...lockedTreasure, id: 'treasure-2', summary: 'Authored valuables' }
    const lockedTrap: DungeonMapData['traps'][number] = {
      id: 'trap-1', roomId: objectiveId, name: 'Authored alarm', severity: 'LOW',
      trigger: 'Disturbing the guardian', effect: 'Alerts reinforcements', detectDc: 12, disarmDc: 13, isLocked: true,
    }
    const secondLockedTrap = { ...lockedTrap, id: 'trap-2', name: 'Authored snare' }
    const authored = {
      ...base,
      encounters: [lockedEncounter, secondLockedEncounter, { ...lockedEncounter, id: 'orphan', roomId: 'deleted-room' }],
      treasures: [lockedTreasure, secondLockedTreasure],
      traps: [lockedTrap, secondLockedTrap],
    }
    expect(dungeonMapSchema.safeParse({ ...authored, encounters: [lockedEncounter, secondLockedEncounter] }).success).toBe(true)
    for (const density of [0, 1]) {
      const contentConfig = { ...config, content: { ...config.content, encounterDensity: density, treasureDensity: density, trapDensity: density } }
      for (const layer of [
        { scope: 'ENCOUNTERS', key: 'encounters', locked: [lockedEncounter, secondLockedEncounter] },
        { scope: 'TREASURE', key: 'treasures', locked: [lockedTreasure, secondLockedTreasure] },
        { scope: 'TRAPS', key: 'traps', locked: [lockedTrap, secondLockedTrap] },
      ] as const) {
        const preserved = service.regenerate(layer.scope, 'different-seed', contentConfig, authored)
        expect(preserved[layer.key].filter(item => item.roomId === objectiveId)).toEqual(layer.locked)
        expect(preserved[layer.key].some(item => item.roomId === 'deleted-room')).toBe(false)
        const replaced = service.regenerate(layer.scope, 'different-seed', contentConfig, authored, { preserveLocks: false })
        expect(replaced[layer.key].some(item => item.isLocked)).toBe(false)
        expect(replaced[layer.key].filter(item => item.roomId === objectiveId)).toHaveLength(density)
        if (density === 0) {
          expect(replaced[layer.key]).toEqual([])
          expect(preserved[layer.key]).toEqual(layer.locked)
        } else {
          const objectiveIndex = replaced[layer.key].findIndex(item => item.roomId === objectiveId)
          expect(preserved[layer.key].slice(0, objectiveIndex)).toEqual(replaced[layer.key].slice(0, objectiveIndex))
          expect(preserved[layer.key].slice(objectiveIndex, objectiveIndex + 2)).toEqual(layer.locked)
          expect(preserved[layer.key].slice(objectiveIndex + 2)).toEqual(replaced[layer.key].slice(objectiveIndex + 1))
        }
      }
    }

    const singleConfig = dungeonGeneratorConfigSchema.parse({ encounterScale: 'SINGLE', content: { encounterDensity: 1, treasureDensity: 1, trapDensity: 1 } })
    const single = service.generateBaseMap('edited-single', singleConfig)
    const formerObjectiveId = single.flow!.objectiveRoomId
    const withoutFlow = { ...single, flow: undefined }
    const removedObjective = {
      ...withoutFlow,
      rooms: single.rooms.filter(room => room.id !== formerObjectiveId),
      corridors: single.corridors.filter(corridor => corridor.fromRoomId !== formerObjectiveId && corridor.toRoomId !== formerObjectiveId),
      doors: single.doors.filter(door => single.corridors.some(corridor => corridor.id === door.corridorId && corridor.fromRoomId !== formerObjectiveId && corridor.toRoomId !== formerObjectiveId)),
      terrain: single.terrain?.filter(feature => feature.roomId !== formerObjectiveId),
      encounters: [], traps: [], treasures: [],
    }
    for (const editedMap of [withoutFlow, removedObjective]) {
      const encounters = service.regenerate('ENCOUNTERS', 'new-content-seed', singleConfig, editedMap)
      const treasures = service.regenerate('TREASURE', 'other-content-seed', singleConfig, editedMap)
      const traps = service.regenerate('TRAPS', 'third-content-seed', singleConfig, editedMap)
      expect(encounters.encounters).toHaveLength(1)
      expect(treasures.treasures).toHaveLength(1)
      expect(traps.traps).toHaveLength(1)
      const targetId = encounters.encounters[0]!.roomId
      expect(editedMap.rooms.some(room => room.id === targetId)).toBe(true)
      expect(treasures.treasures[0]!.roomId).toBe(targetId)
      expect(traps.traps[0]!.roomId).toBe(targetId)
      expect(encounters.encounters[0]!.difficulty).toBe('HARD')
      expect(encounters.flow).toBeUndefined()
      expect(encounters.rooms).toEqual(editedMap.rooms)
      if (editedMap === withoutFlow) expect(targetId).toBe(formerObjectiveId)
      else expect(targetId).not.toBe(formerObjectiveId)
      const emptyConfig = { ...singleConfig, content: { encounterDensity: 0, treasureDensity: 0, trapDensity: 0, dressingDensity: 0 } }
      expect(service.regenerate('ENCOUNTERS', 'zero', emptyConfig, editedMap).encounters).toEqual([])
      expect(service.regenerate('TREASURE', 'zero', emptyConfig, editedMap).treasures).toEqual([])
      expect(service.regenerate('TRAPS', 'zero', emptyConfig, editedMap).traps).toEqual([])
    }
  })
})
