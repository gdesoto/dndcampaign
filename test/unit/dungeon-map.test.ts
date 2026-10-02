import { expect, it } from 'vitest'
import type { DungeonMapData } from '../../shared/types/dungeon'
import { toPlayerSafeMap } from '../../shared/utils/dungeon-map'

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
    metadata: {
      algorithmVersion: '1.0.0', configHash: 'hash', generatedAt: '2026-10-01T00:00:00.000Z',
      seed: 'seed', passHistory: [],
    },
  }
  const original = structuredClone(map)

  const playerMap = toPlayerSafeMap(map)

  expect(playerMap).toEqual({
    ...original,
    rooms: [original.rooms[0], original.rooms[2]],
    corridors: [original.corridors[0]],
    doors: [original.doors[0]],
    traps: [original.traps[0]],
    encounters: [original.encounters[0]],
    treasures: [original.treasures[0]],
    dressing: [original.dressing[0]],
  })
  expect(map).toEqual(original)
  expect(toPlayerSafeMap(playerMap)).toEqual(playerMap)
})
