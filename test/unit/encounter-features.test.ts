import { describe, expect, it } from 'vitest'
import { DungeonGeneratorService } from '../../server/services/dungeon/dungeon-generator.service'
import { routePortalToEdge } from '../../server/services/dungeon/encounter-features'
import { dungeonGeneratorConfigSchema } from '../../shared/schemas/dungeon'
import type { DungeonMapData, DungeonRoomGeometry } from '../../shared/types/dungeon'

const inside = (point: { x: number; y: number }, room: DungeonRoomGeometry) =>
  point.x >= room.x && point.x < room.x + room.width && point.y >= room.y && point.y < room.y + room.height

const cells = (points: Array<{ x: number; y: number }>) => points.slice(1).flatMap((end, index) => {
  const start = points[index]!
  const distance = Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
  return Array.from({ length: distance + 1 }, (_, step) => ({
    x: start.x + Math.sign(end.x - start.x) * step,
    y: start.y + Math.sign(end.y - start.y) * step,
  }))
})

describe('encounter access and tactical features', () => {
  it('provides distinct requested approaches and playable tactical positions for each map type', () => {
    const service = new DungeonGeneratorService()
    for (const mapType of ['DUNGEON', 'BUILDING', 'FOREST'] as const) {
      for (const size of [20, 48]) {
        const config = {
          ...dungeonGeneratorConfigSchema.parse({ mapType, width: size, height: size, floorCount: mapType === 'BUILDING' ? 2 : 1 }),
          accessPoints: { entrances: 3, exits: 2, entranceSide: 'NORTH' as const, concealedEntrance: true },
          tacticalTerrain: { cover: 'HEAVY' as const, elevation: true, difficultTerrain: true, hazards: true, sightlines: 'BROKEN' as const },
          verticalConnections: { basement: false, staircases: 'SINGLE' as const, ladders: false, balconies: false, bridges: true },
        }
        const map = service.generateBaseMap(`features-${mapType}-${size}`, config)
        expect(map.portals?.filter(portal => portal.kind === 'ENTRANCE' && !portal.isSecret)).toHaveLength(3)
        expect(map.portals?.filter(portal => portal.kind === 'EXIT')).toHaveLength(2)
        expect(map.portals?.filter(portal => portal.isSecret)).toHaveLength(1)
        expect(new Set(map.portals!.map(portal => JSON.stringify(portal.points))).size).toBe(6)
        const roomById = new Map(map.rooms.map(room => [room.id, room]))
        for (const portal of map.portals!) {
          const room = roomById.get(portal.roomId)!
          expect(room.isSecret).toBe(false)
          const end = portal.points.at(-1)!
          expect(end.x === 0 || end.y === 0 || end.x === size - 1 || end.y === size - 1).toBe(true)
          for (const point of cells(portal.points)) {
            expect(map.rooms.some(other => other.id !== room.id && other.floor === room.floor && inside(point, other))).toBe(false)
          }
        }
        for (const feature of map.terrain?.filter(item => item.roomId) ?? []) {
          const room = roomById.get(feature.roomId!)!
          expect(inside(feature, room)).toBe(true)
          expect(inside({ x: feature.x + feature.width - 1, y: feature.y + feature.height - 1 }, room)).toBe(true)
          const featureCells = Array.from({ length: feature.width * feature.height }, (_, index) => ({ x: feature.x + index % feature.width, y: feature.y + Math.floor(index / feature.width) }))
          for (const corridor of map.corridors.filter(path => path.fromRoomId === room.id || path.toRoomId === room.id)) {
            expect(cells(corridor.points).some(point => featureCells.some(cell => cell.x === point.x && cell.y === point.y))).toBe(false)
          }
        }
        if (size === 48) {
          for (const kind of ['COVER', 'ELEVATION', 'DIFFICULT', 'HAZARD']) expect(map.terrain?.some(feature => feature.kind === kind)).toBe(true)
          expect(map.terrain?.some(feature => feature.roomId === map.flow!.objectiveRoomId)).toBe(true)
        }
        const bridge = map.corridors.find(corridor => corridor.kind === 'BRIDGE')
        expect(bridge).toBeDefined()
        expect(cells(bridge!.points).filter(point => !inside(point, roomById.get(bridge!.fromRoomId)!) && !inside(point, roomById.get(bridge!.toRoomId)!)).length).toBeGreaterThanOrEqual(2)
      }
      const defaults = dungeonGeneratorConfigSchema.parse({ mapType, width: 48, height: 40 })
      const light = service.generateBaseMap('sightline-comparison', { ...defaults, tacticalTerrain: { cover: 'LIGHT', elevation: false, difficultTerrain: false, hazards: false, sightlines: 'OPEN' } })
      const heavy = service.generateBaseMap('sightline-comparison', { ...defaults, tacticalTerrain: { cover: 'HEAVY', elevation: false, difficultTerrain: false, hazards: false, sightlines: 'BROKEN' } })
      expect(light.terrain?.every(feature => !feature.blocksSight)).toBe(true)
      expect(heavy.terrain?.filter(feature => feature.blocksSight).length).toBeGreaterThan(0)
      expect(heavy.terrain?.filter(feature => feature.kind === 'COVER').length).toBeGreaterThan(light.terrain?.filter(feature => feature.kind === 'COVER').length ?? 0)
    }
  })

  it('reroutes an exterior approach around foreign rooms and preserves its destination side', () => {
    const map: Pick<DungeonMapData, 'width' | 'height' | 'rooms' | 'corridors' | 'portals' | 'terrain'> = {
      width: 20, height: 20, corridors: [], portals: [], terrain: [],
      rooms: [
        { id: 'entry', roomNumber: 1, x: 8, y: 10, width: 4, height: 4, isSecret: false },
        { id: 'obstacle', roomNumber: 2, x: 5, y: 4, width: 10, height: 4, isSecret: false },
      ],
    }
    const route = routePortalToEdge(map, 'entry', 'NORTH')!
    expect(route).not.toBeNull()
    expect(inside(route[0]!, map.rooms[0]!)).toBe(true)
    expect(route.at(-1)!.y).toBe(0)
    expect(cells(route).some(point => inside(point, map.rooms[1]!))).toBe(false)

    // Moving a room must not relocate its entrance into cover or an existing
    // doorway; a facade on the canvas edge is already a valid exterior opening.
    map.terrain = [{ id: 'cover', kind: 'COVER', x: 10, y: 10, width: 1, height: 1, blocksMovement: true }]
    map.portals = [{ id: 'other-entry', kind: 'ENTRANCE', roomId: 'entry', points: [{ x: 9, y: 10 }, { x: 9, y: 9 }] }]
    const movedRoute = routePortalToEdge(map, 'entry', 'NORTH')!
    expect(movedRoute).not.toBeNull()
    expect(movedRoute[0]).not.toEqual({ x: 10, y: 10 })
    expect(movedRoute[0]).not.toEqual({ x: 9, y: 10 })
    map.rooms[0]!.y = 0
    const boundaryRoute = routePortalToEdge(map, 'entry', 'NORTH')!
    expect(boundaryRoute).toHaveLength(2)
    expect(boundaryRoute[0]).toEqual(boundaryRoute[1])
    expect(boundaryRoute[0]!.y).toBe(0)
  })
})
