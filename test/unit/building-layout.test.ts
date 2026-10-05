import { describe, expect, it } from 'vitest'
import { dungeonGeneratorConfigSchema } from '../../shared/schemas/dungeon'
import type { DungeonGeneratorConfig } from '../../shared/types/dungeon'
import { generateBuildingLayout } from '../../server/services/dungeon/building-layout'

type Bounds = { x: number; y: number; width: number; height: number }
type Layout = ReturnType<typeof generateBuildingLayout>

const inside = (point: { x: number; y: number }, bounds: Bounds) =>
  point.x >= bounds.x && point.x < bounds.x + bounds.width
  && point.y >= bounds.y && point.y < bounds.y + bounds.height

const overlaps = (a: Bounds, b: Bounds) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

const configFor = (overrides: Partial<DungeonGeneratorConfig> = {}): DungeonGeneratorConfig => ({
  ...dungeonGeneratorConfigSchema.parse({ mapType: 'BUILDING', width: 20, height: 20 }),
  ...overrides,
})

const generate = (config: DungeonGeneratorConfig) => generateBuildingLayout(() => 0.37, config)

const assertConnectedLayout = (layout: Layout, config: DungeonGeneratorConfig) => {
  const roomById = new Map(layout.rooms.map(room => [room.id, room]))
  const neighbors = new Map(layout.rooms.map(room => [room.id, new Set<string>()]))
  expect(roomById.size).toBe(layout.rooms.length)
  expect(new Set(layout.rooms.map(room => room.roomNumber)).size).toBe(layout.rooms.length)
  for (const [index, room] of layout.rooms.entries()) {
    expect(room.label).toBeTruthy()
    expect(room.width).toBeGreaterThan(0)
    expect(room.height).toBeGreaterThan(0)
    expect(inside(room, { x: 0, y: 0, width: config.width, height: config.height })).toBe(true)
    expect(room.x + room.width).toBeLessThanOrEqual(config.width)
    expect(room.y + room.height).toBeLessThanOrEqual(config.height)
    expect(room.floor ?? 0).toBeGreaterThanOrEqual(0)
    expect(room.floor ?? 0).toBeLessThan(config.floorCount ?? 1)
    for (const other of layout.rooms.slice(index + 1)) {
      if (room.floor === other.floor) expect(overlaps(room, other), `${room.id} overlaps ${other.id}`).toBe(false)
    }
  }
  for (const connection of [...layout.corridors, ...layout.stairs]) {
    expect(roomById.has(connection.fromRoomId)).toBe(true)
    expect(roomById.has(connection.toRoomId)).toBe(true)
    neighbors.get(connection.fromRoomId)!.add(connection.toRoomId)
    neighbors.get(connection.toRoomId)!.add(connection.fromRoomId)
  }
  for (const corridor of layout.corridors) {
    const from = roomById.get(corridor.fromRoomId)!
    const to = roomById.get(corridor.toRoomId)!
    expect(from.floor).toBe(to.floor)
    expect(inside(corridor.points[0]!, from)).toBe(true)
    expect(inside(corridor.points.at(-1)!, to)).toBe(true)
    for (const [index, point] of corridor.points.entries()) {
      expect(inside(point, { x: 0, y: 0, width: config.width, height: config.height })).toBe(true)
      if (index) {
        const previous = corridor.points[index - 1]!
        expect(point.x === previous.x || point.y === previous.y).toBe(true)
      }
    }
  }
  for (const stair of layout.stairs) {
    const from = roomById.get(stair.fromRoomId)!
    const to = roomById.get(stair.toRoomId)!
    expect((to.floor ?? 0) - (from.floor ?? 0)).toBe(1)
    for (const room of [from, to]) {
      expect(inside(stair, room)).toBe(true)
      expect(inside({ x: stair.x + (stair.width ?? 1) - 1, y: stair.y + (stair.height ?? 1) - 1 }, room)).toBe(true)
    }
  }
  for (const portal of layout.portals) {
    const room = roomById.get(portal.roomId)!
    expect(inside(portal.points[0]!, room)).toBe(true)
    expect(room.floor ?? 0).toBe(config.verticalConnections?.basement ? 1 : 0)
    const end = portal.points.at(-1)!
    expect(end.x === 0 || end.x === config.width - 1 || end.y === 0 || end.y === config.height - 1).toBe(true)
  }
  const { entryRoomId, objectiveRoomId, exitRoomId, routeRoomIds } = layout.flow
  expect(new Set([entryRoomId, objectiveRoomId, exitRoomId]).size).toBe(3)
  expect(routeRoomIds[0]).toBe(entryRoomId)
  expect(routeRoomIds.at(-1)).toBe(exitRoomId)
  expect(routeRoomIds).toContain(objectiveRoomId)
  expect(layout.portals.find(portal => portal.kind === 'ENTRANCE')?.roomId).toBe(entryRoomId)
  expect(layout.portals.find(portal => portal.kind === 'EXIT')?.roomId).toBe(exitRoomId)
  for (const [index, id] of routeRoomIds.entries()) {
    if (index) expect(neighbors.get(routeRoomIds[index - 1]!)!.has(id), `route cannot walk to ${id}`).toBe(true)
  }
  const reachable = new Set([entryRoomId])
  for (const id of reachable) for (const neighbor of neighbors.get(id)!) reachable.add(neighbor)
  expect(reachable.size).toBe(layout.rooms.length)
}

describe('building encounter layout', () => {
  it('fits a playable basement and upper floors with independent stairs, ladders and accessible balconies on the smallest canvas', () => {
    const config = configFor({
      floorCount: 4,
      encounterFlow: 'LOOP',
      encounterScale: 'COMPLEX',
      verticalConnections: { basement: true, staircases: 'DUAL', ladders: true, balconies: true, bridges: true },
    })
    const layout = generate(config)
    assertConnectedLayout(layout, config)
    expect(layout.floorLabels).toHaveLength(4)
    expect(layout.floorLabels[0]).toMatch(/basement/i)
    expect(layout.floorLabels[1]).toMatch(/ground/i)
    expect(layout.rooms.find(room => room.id === layout.flow.objectiveRoomId)?.floor).toBe(3)

    const stairs = layout.stairs.filter(connection => connection.kind === 'STAIRS')
    const ladders = layout.stairs.filter(connection => connection.kind === 'LADDER')
    expect(stairs).toHaveLength(6)
    expect(ladders.length).toBeGreaterThanOrEqual(3)
    expect(new Set(stairs.map(stair => `${stair.x}:${stair.y}:${stair.width}:${stair.height}`)).size).toBe(2)
    for (let floor = 0; floor < 4; floor += 1) {
      expect(layout.rooms.filter(room => room.floor === floor && room.kind === 'STAIRWELL')).toHaveLength(2)
    }
    for (const stair of stairs) {
      expect([stair.width, stair.height].sort()).toEqual([2, 4])
      for (const id of [stair.fromRoomId, stair.toRoomId]) {
        expect(layout.rooms.find(room => room.id === id)?.kind).toBe('STAIRWELL')
      }
    }
    for (const ladder of ladders) {
      expect(ladder).toMatchObject({ width: 1, height: 1 })
      for (const id of [ladder.fromRoomId, ladder.toRoomId]) {
        expect(layout.rooms.find(room => room.id === id)?.kind).not.toBe('STAIRWELL')
        expect(stairs.some(stair => stair.fromRoomId === id || stair.toRoomId === id)).toBe(false)
      }
    }
    const groundRooms = layout.rooms.filter(room => room.floor === 1)
    const footprint = {
      x: Math.min(...groundRooms.map(room => room.x)),
      y: Math.min(...groundRooms.map(room => room.y)),
      width: 0,
      height: 0,
    }
    footprint.width = Math.max(...groundRooms.map(room => room.x + room.width)) - footprint.x
    footprint.height = Math.max(...groundRooms.map(room => room.y + room.height)) - footprint.y
    const balconies = layout.rooms.filter(room => room.kind === 'BALCONY')
    expect(new Set(balconies.map(room => room.floor))).toEqual(new Set([2, 3]))
    for (const balcony of balconies) {
      expect(overlaps(balcony, footprint)).toBe(false)
      expect(layout.corridors.some(corridor => corridor.fromRoomId === balcony.id || corridor.toRoomId === balcony.id)).toBe(true)
    }
    expect(layout.corridors.some(corridor => {
      const floor = layout.rooms.find(room => room.id === corridor.fromRoomId)!.floor
      const gapCells = new Set<string>()
      for (let index = 1; index < corridor.points.length; index += 1) {
        const from = corridor.points[index - 1]!
        const to = corridor.points[index]!
        const distance = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
        for (let step = 0; step <= distance; step += 1) {
          const point = { x: from.x + Math.sign(to.x - from.x) * step, y: from.y + Math.sign(to.y - from.y) * step }
          if (!layout.rooms.some(room => room.floor === floor && inside(point, room))) gapCells.add(`${point.x}:${point.y}`)
        }
      }
      return gapCells.size >= 2
    }), 'a bridge must cross a real gap between rooms').toBe(true)

    const basementConfig = { ...config, floorCount: 2, verticalConnections: { ...config.verticalConnections!, balconies: false } }
    const basement = generate(basementConfig)
    assertConnectedLayout(basement, basementConfig)
    expect(basement.rooms.find(room => room.id === basement.flow.objectiveRoomId)?.floor).toBe(0)
    expect(basement.rooms.some(room => room.kind === 'BALCONY')).toBe(false)
  })

  it('separates encounter scale from canvas size and honors cardinal entrances on wide and narrow maps', () => {
    const countsBySize = [30, 40].map(size => {
      const counts = (['SINGLE', 'SEQUENCE', 'COMPLEX'] as const).map(encounterScale => {
        const config = configFor({ width: size, height: size, encounterScale })
        const layout = generate(config)
        assertConnectedLayout(layout, config)
        return layout.rooms.length
      })
      expect(counts[0]).toBeLessThan(counts[1]!)
      expect(counts[1]).toBeLessThan(counts[2]!)
      expect(generate(configFor({ width: size, height: size })).rooms.length).toBe(counts[1])
      return counts
    })
    expect(countsBySize[0]!.slice(0, 2)).toEqual(countsBySize[1]!.slice(0, 2))
    expect(countsBySize[1]![2]).toBeGreaterThanOrEqual(18)

    for (const [index, entranceSide] of (['NORTH', 'EAST', 'SOUTH', 'WEST'] as const).entries()) {
      const config = configFor({
        width: index % 2 ? 20 : 60,
        height: index % 2 ? 60 : 20,
        floorCount: 2,
        accessPoints: { entrances: 1, exits: 1, entranceSide, concealedEntrance: false },
      })
      const layout = generate(config)
      assertConnectedLayout(layout, config)
      const end = layout.portals.find(portal => portal.kind === 'ENTRANCE')!.points.at(-1)!
      expect(entranceSide === 'NORTH' ? end.y === 0 : entranceSide === 'SOUTH' ? end.y === config.height - 1
        : entranceSide === 'WEST' ? end.x === 0 : end.x === config.width - 1).toBe(true)
    }
  })
})
