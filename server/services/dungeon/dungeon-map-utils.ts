import { dungeonMapSchema } from '../../../shared/schemas/dungeon'
import type { DungeonMapData, DungeonPassHistoryEntry } from '../../../shared/types/dungeon'

export const parseDungeonMap = (value: unknown): DungeonMapData => dungeonMapSchema.parse(value)

export const createPassHistoryEntry = (
  input: Omit<DungeonPassHistoryEntry, 'startedAt' | 'finishedAt'> & { startedAt?: string; finishedAt?: string },
): DungeonPassHistoryEntry => ({
  ...input,
  startedAt: input.startedAt || new Date().toISOString(),
  finishedAt: input.finishedAt || new Date().toISOString(),
})

export const withHistoryEntry = (map: DungeonMapData, entry: DungeonPassHistoryEntry): DungeonMapData => ({
  ...map,
  metadata: {
    ...map.metadata,
    passHistory: [...map.metadata.passHistory, entry].slice(-60),
  },
})
