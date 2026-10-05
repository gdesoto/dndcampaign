import { expect, it } from 'vitest'
import type { DungeonMapData } from '../../shared/types/dungeon'
import { toPlayerSafeDungeonConfig, toPlayerSafeMap } from '../../shared/utils/dungeon-map'
import { dungeonGeneratorConfigSchema } from '../../shared/schemas/dungeon'

it('projects visible dungeon geometry and room contents without changing the source or unrelated map data', () => {
  const map: DungeonMapData = {
    schemaVersion: 1,
    gridType: 'SQUARE',
    width: 60,
    height: 60,
    cellSize: 32,
    rooms: [
      { id: 'entry', roomNumber: 1, x: 2, y: 2, width: 8, height: 8, isSecret: false },
      { id: 'secret', roomNumber: 2, x: 20, y: 20, width: 8, height: 8, isSecret: true },
      { id: 'hall', roomNumber: 3, x: 40, y: 40, width: 8, height: 8, isSecret: false },
    ],
    corridors: [
      { id: 'visible', fromRoomId: 'entry', toRoomId: 'hall', points: [{ x: 6, y: 6 }, { x: 44, y: 44 }] },
      { id: 'to-secret', fromRoomId: 'entry', toRoomId: 'secret', points: [{ x: 6, y: 6 }, { x: 24, y: 24 }] },
      { id: 'from-secret', fromRoomId: 'secret', toRoomId: 'hall', points: [{ x: 24, y: 24 }, { x: 44, y: 44 }] },
    ],
    doors: [
      { id: 'visible-door', x: 6, y: 6, corridorId: 'visible', isLocked: true, isSecret: false, isSpecial: true },
      { id: 'secret-door', x: 7, y: 7, corridorId: 'visible', isLocked: false, isSecret: true, isSpecial: false },
      { id: 'to-secret-door', x: 8, y: 8, corridorId: 'to-secret', isLocked: false, isSecret: false, isSpecial: false },
      { id: 'from-secret-door', x: 9, y: 9, corridorId: 'from-secret', isLocked: false, isSecret: false, isSpecial: false },
    ],
    walls: [{ id: 'wall', x1: 20, y1: 20, x2: 28, y2: 20 }],
    traps: ['entry', 'secret'].map(roomId => ({
      id: `trap-${roomId}`, roomId, name: 'Pit', severity: 'LOW', trigger: 'Step', effect: 'Fall',
      detectDc: 10, disarmDc: 10, isLocked: true,
    })),
    encounters: ['entry', 'secret'].map(roomId => ({
      id: `encounter-${roomId}`, roomId, title: 'Guards', difficulty: 'EASY', summary: 'Two guards', isLocked: true,
    })),
    treasures: ['entry', 'secret'].map(roomId => ({
      id: `treasure-${roomId}`, roomId, category: 'COIN', rarity: 'COMMON', summary: 'Gold coins', isLocked: true,
    })),
    dressing: ['entry', 'secret'].map(roomId => ({
      id: `dressing-${roomId}`, roomId, text: 'Old banners', isLocked: true,
    })),
    zones: [{ id: 'zone', type: 'HAZARD', label: 'Mist', cells: [{ x: 20, y: 20 }] }],
    stairs: [
      { id: 'visible-stairs', fromRoomId: 'entry', toRoomId: 'hall', x: 5, y: 5 },
      { id: 'secret-stairs', fromRoomId: 'entry', toRoomId: 'secret', x: 6, y: 6 },
    ],
    portals: [
      { id: 'entrance', kind: 'ENTRANCE', roomId: 'entry', points: [{ x: 2, y: 5 }, { x: 0, y: 5 }] },
      { id: 'hidden-exit', kind: 'EXIT', roomId: 'secret', points: [{ x: 20, y: 24 }, { x: 0, y: 24 }] },
      { id: 'concealed-access', kind: 'ENTRANCE', roomId: 'entry', isSecret: true, label: 'Hidden hatch', points: [{ x: 5, y: 2 }, { x: 5, y: 0 }] },
    ],
    terrain: [
      { id: 'tree', kind: 'TREE', x: 12, y: 12, width: 1, height: 1 },
      { id: 'crate', kind: 'COVER', roomId: 'entry', x: 3, y: 3, width: 1, height: 1, blocksMovement: true, blocksSight: true },
      { id: 'hidden-hazard', kind: 'HAZARD', roomId: 'secret', x: 23, y: 23, width: 1, height: 1 },
    ],
    flow: { style: 'BRANCHING', entryRoomId: 'entry', objectiveRoomId: 'secret', exitRoomId: 'hall', routeRoomIds: ['entry', 'secret', 'hall'] },
    metadata: {
      algorithmVersion: '1.0.0', configHash: 'hash', generatedAt: '2026-10-01T00:00:00.000Z',
      seed: 'seed', passHistory: [],
    },
  }
  const original = structuredClone(map)
  const { flow: _flow, ...visibleMetadata } = original

  const playerMap = toPlayerSafeMap(map)

  expect(playerMap).toEqual({
    ...visibleMetadata,
    rooms: [original.rooms[0], original.rooms[2]],
    corridors: [original.corridors[0]],
    doors: [original.doors[0]],
    traps: [original.traps[0]],
    encounters: [original.encounters[0]],
    treasures: [original.treasures[0]],
    dressing: [original.dressing[0]],
    stairs: [original.stairs![0]],
    portals: [original.portals![0]],
    terrain: [original.terrain![0], original.terrain![1]],
  })
  expect(playerMap).not.toHaveProperty('flow')
  expect(map).toEqual(original)
  expect(toPlayerSafeMap(playerMap)).toEqual(playerMap)
  const config = dungeonGeneratorConfigSchema.parse({ accessPoints: { concealedEntrance: true } })
  expect(toPlayerSafeDungeonConfig(config).accessPoints?.concealedEntrance).toBe(false)
  expect(config.accessPoints?.concealedEntrance).toBe(true)
  expect(toPlayerSafeDungeonConfig(config)).toEqual({ ...config, accessPoints: { ...config.accessPoints, concealedEntrance: false } })
})
