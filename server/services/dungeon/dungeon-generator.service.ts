import { createHash } from 'node:crypto'
import type { CampaignDungeonRegenerateScope, DungeonGeneratorConfig, DungeonMapData } from '#shared/types/dungeon'
import { createPassHistoryEntry, withHistoryEntry } from './dungeon-map-utils'

const DUNGEON_GENERATOR_VERSION = '1.1.0'

type SeededRng = () => number

const hashSeed = (seed: string) => {
  let hash = 2166136261 >>> 0
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const createSeededRng = (seed: string): SeededRng => {
  let state = hashSeed(seed) || 0x9e3779b9
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0xffffffff
  }
}

const randomInt = (rng: SeededRng, minInclusive: number, maxInclusive: number) =>
  Math.floor(rng() * (maxInclusive - minInclusive + 1)) + minInclusive

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  padding = 1,
) =>
  a.x < b.x + b.width + padding
  && a.x + a.width + padding > b.x
  && a.y < b.y + b.height + padding
  && a.y + a.height + padding > b.y

const generateConfigHash = (seed: string, config: DungeonGeneratorConfig) =>
  createHash('sha256').update(`${seed}:${JSON.stringify(config)}`).digest('hex').slice(0, 16)

const passRng = (seed: string, pass: string, configHash: string) => createSeededRng(`${seed}:${pass}:${configHash}`)

const preserveById = <T extends { id: string; isLocked: boolean }>(
  next: T[],
  previous: T[],
  preserveLocks: boolean,
): T[] => {
  if (!preserveLocks) return next
  const prevById = new Map(previous.map((item) => [item.id, item]))
  return next.map((item) => {
    const prev = prevById.get(item.id)
    if (!prev || !prev.isLocked) return item
    return { ...prev }
  })
}

export class DungeonGeneratorService {
  getGeneratorVersion() {
    return DUNGEON_GENERATOR_VERSION
  }

  buildDefaultSeed() {
    return `dungeon-${Date.now().toString(36)}`
  }

  buildConfigHash(seed: string, config: DungeonGeneratorConfig) {
    return generateConfigHash(seed, config)
  }

  private generateLayoutPass(seed: string, config: DungeonGeneratorConfig) {
    const rng = passRng(seed, 'layout', generateConfigHash(seed, config))
    const area = config.width * config.height
    const targetRooms = clamp(Math.floor(area * config.layout.roomDensity * 0.0022), 4, 180)
    const maxAttempts = targetRooms * 24

    const rooms: DungeonMapData['rooms'] = []
    let attempts = 0

    while (rooms.length < targetRooms && attempts < maxAttempts) {
      attempts += 1
      const width = randomInt(rng, config.layout.minRoomSize, config.layout.maxRoomSize)
      const height = randomInt(rng, config.layout.minRoomSize, config.layout.maxRoomSize)
      if (width >= config.width - 2 || height >= config.height - 2) continue

      const x = randomInt(rng, 1, Math.max(1, config.width - width - 1))
      const y = randomInt(rng, 1, Math.max(1, config.height - height - 1))
      const isSecret = rng() < config.layout.secretRoomChance

      const candidate = { x, y, width, height }
      if (rooms.some((room) => overlaps(candidate, room))) continue
      rooms.push({
        id: `room-${rooms.length + 1}`,
        roomNumber: rooms.length + 1,
        x,
        y,
        width,
        height,
        isSecret,
      })
    }

    if (rooms.length < 2) {
      rooms.push({
        id: 'room-fallback-a',
        roomNumber: 1,
        x: 2,
        y: 2,
        width: 6,
        height: 6,
        isSecret: false,
      })
      rooms.push({
        id: 'room-fallback-b',
        roomNumber: 2,
        x: Math.max(10, config.width - 10),
        y: Math.max(10, config.height - 10),
        width: 6,
        height: 6,
        isSecret: false,
      })
    }

    const sortedRooms = [...rooms].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
    const centerOf = (room: DungeonMapData['rooms'][number]) => ({
      x: room.x + Math.floor(room.width / 2),
      y: room.y + Math.floor(room.height / 2),
    })
    const corridors: DungeonMapData['corridors'] = []
    for (let index = 1; index < sortedRooms.length; index += 1) {
      const from = sortedRooms[index - 1]!
      const to = sortedRooms[index]!
      const fromCenter = centerOf(from)
      const toCenter = centerOf(to)
      const horizontalFirst = config.layout.corridorStyle === 'STRAIGHT'
        || (config.layout.corridorStyle === 'MIXED' && rng() >= 0.5)
      const points = horizontalFirst
        ? [{ x: fromCenter.x, y: fromCenter.y }, { x: toCenter.x, y: fromCenter.y }, { x: toCenter.x, y: toCenter.y }]
        : [{ x: fromCenter.x, y: fromCenter.y }, { x: fromCenter.x, y: toCenter.y }, { x: toCenter.x, y: toCenter.y }]
      corridors.push({
        id: `corridor-${index}`,
        fromRoomId: from.id,
        toRoomId: to.id,
        points,
      })
    }

    return {
      rooms: rooms.sort((a, b) => a.roomNumber - b.roomNumber),
      corridors,
      changedCounts: {
        rooms: rooms.length,
        corridors: corridors.length,
      },
    }
  }

  private generateDoorsPass(seed: string, config: DungeonGeneratorConfig, map: Pick<DungeonMapData, 'corridors'>) {
    const rng = passRng(seed, 'doors', generateConfigHash(seed, config))
    const doors: DungeonMapData['doors'] = []
    for (const corridor of map.corridors) {
      if (corridor.points.length < 2) continue
      if (rng() <= config.doors.doorFrequency) {
        const start = corridor.points[0]!
        doors.push({
          id: `door-${doors.length + 1}`,
          x: start.x,
          y: start.y,
          corridorId: corridor.id,
          isLocked: rng() < config.doors.lockedDoorChance,
          isSecret: rng() < config.doors.secretDoorChance,
          isSpecial: rng() < config.doors.specialDoorChance,
        })
      }
      if (rng() <= config.doors.doorFrequency) {
        const end = corridor.points[corridor.points.length - 1]!
        doors.push({
          id: `door-${doors.length + 1}`,
          x: end.x,
          y: end.y,
          corridorId: corridor.id,
          isLocked: rng() < config.doors.lockedDoorChance,
          isSecret: rng() < config.doors.secretDoorChance,
          isSpecial: rng() < config.doors.specialDoorChance,
        })
      }
    }
    return { doors, changedCounts: { doors: doors.length } }
  }

  private generateTrapsPass(seed: string, config: DungeonGeneratorConfig, map: Pick<DungeonMapData, 'rooms'>) {
    const rng = passRng(seed, 'traps', generateConfigHash(seed, config))
    const traps = map.rooms
      .filter(() => rng() < config.content.trapDensity)
      .map((room, index) => {
        const severity = rng() < 0.2 ? 'HIGH' : rng() < 0.6 ? 'MEDIUM' : 'LOW'
        const baseDc = severity === 'HIGH' ? 16 : severity === 'MEDIUM' ? 13 : 10
        return {
          id: `trap-${index + 1}`,
          roomId: room.id,
          name: `${severity} Trap`,
          severity,
          trigger: `Triggered near room ${room.roomNumber} entry`,
          effect: severity === 'HIGH' ? 'Heavy damage and restrained condition' : 'Damage and slowed movement',
          detectDc: baseDc + randomInt(rng, 0, 3),
          disarmDc: baseDc + randomInt(rng, 1, 4),
          isLocked: false,
        } satisfies DungeonMapData['traps'][number]
      })
    return { traps, changedCounts: { traps: traps.length } }
  }

  private generateEncountersPass(seed: string, config: DungeonGeneratorConfig, map: Pick<DungeonMapData, 'rooms'>) {
    const rng = passRng(seed, 'encounters', generateConfigHash(seed, config))
    const encounters = map.rooms
      .filter(() => rng() < config.content.encounterDensity)
      .map((room, index) => {
        const difficulty = rng() < 0.2 ? 'DEADLY' : rng() < 0.45 ? 'HARD' : rng() < 0.75 ? 'MEDIUM' : 'EASY'
        return {
          id: `encounter-${index + 1}`,
          roomId: room.id,
          title: `Encounter ${room.roomNumber}`,
          difficulty,
          summary: `${difficulty} skirmish with theme-aligned foes.`,
          isLocked: false,
        } satisfies DungeonMapData['encounters'][number]
      })
    return { encounters, changedCounts: { encounters: encounters.length } }
  }

  private generateTreasurePass(seed: string, config: DungeonGeneratorConfig, map: Pick<DungeonMapData, 'rooms'>) {
    const rng = passRng(seed, 'treasure', generateConfigHash(seed, config))
    const treasures = map.rooms
      .filter(() => rng() < config.content.treasureDensity)
      .map((room, index) => {
        const rarity = rng() < 0.1 ? 'VERY_RARE' : rng() < 0.25 ? 'RARE' : rng() < 0.55 ? 'UNCOMMON' : 'COMMON'
        const category = rng() < 0.2 ? 'MAGIC' : rng() < 0.5 ? 'ITEM' : rng() < 0.75 ? 'ART' : 'COIN'
        return {
          id: `treasure-${index + 1}`,
          roomId: room.id,
          category,
          rarity,
          summary: `${rarity.replace('_', ' ')} ${category.toLowerCase()} cache.`,
          isLocked: false,
        } satisfies DungeonMapData['treasures'][number]
      })
    return { treasures, changedCounts: { treasure: treasures.length } }
  }

  private generateDressingPass(seed: string, config: DungeonGeneratorConfig, map: Pick<DungeonMapData, 'rooms'>) {
    const rng = passRng(seed, 'dressing', generateConfigHash(seed, config))
    const dressing = map.rooms
      .filter(() => rng() < config.content.dressingDensity)
      .map((room, index) => ({
        id: `dressing-${index + 1}`,
        roomId: room.id,
        text: `Atmospheric detail for room ${room.roomNumber} (${config.theme}).`,
        isLocked: false,
      }))
    return { dressing, changedCounts: { dressing: dressing.length } }
  }

  generateBaseMap(seed: string, config: DungeonGeneratorConfig): DungeonMapData {
    const configHash = generateConfigHash(seed, config)
    const startedAt = new Date().toISOString()
    const layout = this.generateLayoutPass(seed, config)
    const doors = this.generateDoorsPass(seed, config, { corridors: layout.corridors })
    const traps = this.generateTrapsPass(seed, config, { rooms: layout.rooms })
    const encounters = this.generateEncountersPass(seed, config, { rooms: layout.rooms })
    const treasure = this.generateTreasurePass(seed, config, { rooms: layout.rooms })
    const dressing = this.generateDressingPass(seed, config, { rooms: layout.rooms })
    const finishedAt = new Date().toISOString()

    let map: DungeonMapData = {
      schemaVersion: 1,
      gridType: config.gridType,
      width: config.width,
      height: config.height,
      cellSize: config.cellSize,
      rooms: layout.rooms,
      corridors: layout.corridors,
      doors: doors.doors,
      walls: [],
      traps: traps.traps,
      encounters: encounters.encounters,
      treasures: treasure.treasures,
      dressing: dressing.dressing,
      zones: [],
      metadata: {
        algorithmVersion: DUNGEON_GENERATOR_VERSION,
        configHash,
        generatedAt: finishedAt,
        seed,
        passHistory: [],
      },
    }

    map = withHistoryEntry(
      map,
      createPassHistoryEntry({
        pass: 'LAYOUT',
        scope: 'FULL',
        seed,
        configHash,
        startedAt,
        finishedAt,
        changedCounts: {
          ...layout.changedCounts,
          ...doors.changedCounts,
          ...traps.changedCounts,
          ...encounters.changedCounts,
          ...treasure.changedCounts,
          ...dressing.changedCounts,
        },
      }),
    )
    return map
  }

  regenerate(
    scope: CampaignDungeonRegenerateScope,
    seed: string,
    config: DungeonGeneratorConfig,
    existingMap: DungeonMapData,
    options: { preserveLocks?: boolean } = {},
  ) {
    const preserveLocks = options.preserveLocks ?? true
    const configHash = generateConfigHash(seed, config)
    const startedAt = new Date().toISOString()

    if (scope === 'FULL') {
      const rebuilt = this.generateBaseMap(seed, config)
      return withHistoryEntry(
        rebuilt,
        createPassHistoryEntry({
          pass: 'LAYOUT',
          scope,
          seed,
          configHash,
          startedAt,
          changedCounts: {
            rooms: rebuilt.rooms.length,
            corridors: rebuilt.corridors.length,
            doors: rebuilt.doors.length,
            traps: rebuilt.traps.length,
            encounters: rebuilt.encounters.length,
            treasure: rebuilt.treasures.length,
            dressing: rebuilt.dressing.length,
          },
        }),
      )
    }

    if (scope === 'LAYOUT') {
      const rebuilt = this.generateBaseMap(seed, config)
      return withHistoryEntry(
        rebuilt,
        createPassHistoryEntry({
          pass: 'LAYOUT',
          scope,
          seed,
          configHash,
          startedAt,
          changedCounts: {
            rooms: rebuilt.rooms.length,
            corridors: rebuilt.corridors.length,
            doors: rebuilt.doors.length,
            traps: rebuilt.traps.length,
            encounters: rebuilt.encounters.length,
            treasure: rebuilt.treasures.length,
            dressing: rebuilt.dressing.length,
          },
        }),
      )
    }

    if (scope === 'DOORS') {
      const generatedDoors = this.generateDoorsPass(seed, config, { corridors: existingMap.corridors }).doors
      const existingDoorByKey = new Map(
        existingMap.doors.map((door) => [`${door.corridorId}:${door.x}:${door.y}`, door] as const),
      )
      const doors = preserveLocks
        ? generatedDoors.map((door) => {
          const previous = existingDoorByKey.get(`${door.corridorId}:${door.x}:${door.y}`)
          if (!previous || !previous.isLocked) return door
          return {
            ...door,
            isLocked: previous.isLocked,
            isSecret: previous.isSecret,
            isSpecial: previous.isSpecial,
          }
        })
        : generatedDoors
      return withHistoryEntry(
        {
          ...existingMap,
          doors,
          metadata: {
            ...existingMap.metadata,
            algorithmVersion: DUNGEON_GENERATOR_VERSION,
            configHash,
            generatedAt: new Date().toISOString(),
            seed,
          },
        },
        createPassHistoryEntry({
          pass: 'DOORS',
          scope,
          seed,
          configHash,
          startedAt,
          changedCounts: { doors: doors.length },
        }),
      )
    }

    if (scope === 'TRAPS') {
      const generated = this.generateTrapsPass(seed, config, { rooms: existingMap.rooms }).traps
      const traps = preserveById(generated, existingMap.traps, preserveLocks)
      return withHistoryEntry(
        {
          ...existingMap,
          traps,
          metadata: {
            ...existingMap.metadata,
            algorithmVersion: DUNGEON_GENERATOR_VERSION,
            configHash,
            generatedAt: new Date().toISOString(),
            seed,
          },
        },
        createPassHistoryEntry({
          pass: 'TRAPS',
          scope,
          seed,
          configHash,
          startedAt,
          changedCounts: { traps: traps.length },
        }),
      )
    }

    if (scope === 'ENCOUNTERS') {
      const generated = this.generateEncountersPass(seed, config, { rooms: existingMap.rooms }).encounters
      const encounters = preserveById(generated, existingMap.encounters, preserveLocks)
      return withHistoryEntry(
        {
          ...existingMap,
          encounters,
          metadata: {
            ...existingMap.metadata,
            algorithmVersion: DUNGEON_GENERATOR_VERSION,
            configHash,
            generatedAt: new Date().toISOString(),
            seed,
          },
        },
        createPassHistoryEntry({
          pass: 'ENCOUNTERS',
          scope,
          seed,
          configHash,
          startedAt,
          changedCounts: { encounters: encounters.length },
        }),
      )
    }

    const generated = this.generateTreasurePass(seed, config, { rooms: existingMap.rooms }).treasures
    const treasures = preserveById(generated, existingMap.treasures, preserveLocks)
    return withHistoryEntry(
      {
        ...existingMap,
        treasures,
        metadata: {
          ...existingMap.metadata,
          algorithmVersion: DUNGEON_GENERATOR_VERSION,
          configHash,
          generatedAt: new Date().toISOString(),
          seed,
        },
      },
      createPassHistoryEntry({
        pass: 'TREASURE',
        scope,
        seed,
        configHash,
        startedAt,
        changedCounts: { treasure: treasures.length },
      }),
    )
  }
}
