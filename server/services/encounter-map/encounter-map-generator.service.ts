import { createHash } from 'node:crypto'
import type { CampaignEncounterMapRegenerateScope, EncounterMapGeneratorConfig, EncounterMapData, EncounterMapPassHistoryEntry } from '#shared/types/encounter-map'
import { generateEncounterLayout } from './encounter-map-layout'

const ENCOUNTER_MAP_GENERATOR_VERSION = '4.1.0'

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
    return (state >>> 0) / 0x100000000
  }
}

const randomInt = (rng: SeededRng, minInclusive: number, maxInclusive: number) =>
  Math.floor(rng() * (maxInclusive - minInclusive + 1)) + minInclusive

const generateConfigHash = (seed: string, config: EncounterMapGeneratorConfig) =>
  createHash('sha256').update(`${seed}:${JSON.stringify(config)}`).digest('hex').slice(0, 16)

const passRng = (seed: string, pass: string, configHash: string) => createSeededRng(`${seed}:${pass}:${configHash}`)

const withPassHistory = (
  map: EncounterMapData,
  input: Omit<EncounterMapPassHistoryEntry, 'startedAt' | 'finishedAt'> & { startedAt?: string; finishedAt?: string },
): EncounterMapData => ({
  ...map,
  metadata: {
    ...map.metadata,
    passHistory: [...map.metadata.passHistory, {
      ...input,
      startedAt: input.startedAt || new Date().toISOString(),
      finishedAt: input.finishedAt || new Date().toISOString(),
    }].slice(-60),
  },
})

type ContentMap = Pick<EncounterMapData, 'rooms' | 'flow'> & Partial<Pick<EncounterMapData, 'encounters' | 'treasures' | 'traps' | 'portals'>>

// Geometry edits discard the old route plan. Keep all SINGLE content layers
// aimed at one suitable existing area without rebuilding that obsolete plan.
const singleEncounterTarget = (map: ContentMap) => {
  const candidates = map.rooms.filter(room => room.kind !== 'STAIRWELL' && room.kind !== 'BALCONY')
  const validIds = new Set(candidates.map(room => room.id))
  if (map.flow && validIds.has(map.flow.objectiveRoomId)) return map.flow.objectiveRoomId
  const existingEncounter = map.encounters?.find(item => validIds.has(item.roomId) && item.title.endsWith(': Final confrontation'))
    ?? map.encounters?.find(item => validIds.has(item.roomId))
  const existingTreasure = map.treasures?.find(item => validIds.has(item.roomId) && item.summary.includes("encounter's main reward"))
    ?? map.treasures?.find(item => validIds.has(item.roomId))
  const existingRoomId = existingEncounter?.roomId ?? existingTreasure?.roomId ?? map.traps?.find(item => validIds.has(item.roomId))?.roomId
  if (existingRoomId) return existingRoomId
  const accessRooms = new Set(map.portals?.map(portal => portal.roomId) ?? [])
  const inner = candidates.filter(room => !accessRooms.has(room.id) && !room.isSecret)
  const available = inner.length ? inner : candidates
  const chambers = available.filter(room => room.kind !== 'HALL')
  const suitable = chambers.length ? chambers : available
  return [...suitable].sort((a, b) => b.width * b.height - a.width * a.height || a.roomNumber - b.roomNumber)[0]?.id
}

const preserveRoomContent = <T extends { id: string; roomId: string; isLocked: boolean }>(
  next: T[],
  previous: T[],
  preserveLocks: boolean,
  rooms: EncounterMapData['rooms'],
): T[] => {
  if (!preserveLocks) return next
  const validRoomIds = new Set(rooms.map(room => room.id))
  const locked = previous.filter(item => item.isLocked && validRoomIds.has(item.roomId))
  const lockedByRoom = new Map<string, T[]>()
  for (const item of locked) {
    const roomItems = lockedByRoom.get(item.roomId) ?? []
    roomItems.push(item)
    lockedByRoom.set(item.roomId, roomItems)
  }
  const merged = next.flatMap(item => lockedByRoom.get(item.roomId) ?? [item])
  const generatedRoomIds = new Set(next.map(item => item.roomId))
  return [...merged, ...locked.filter(item => !generatedRoomIds.has(item.roomId))].map(item => ({ ...item }))
}

export class EncounterMapGeneratorService {
  getGeneratorVersion() {
    return ENCOUNTER_MAP_GENERATOR_VERSION
  }

  buildDefaultSeed() {
    return `encounter-map-${Date.now().toString(36)}`
  }

  private generateLayoutPass(seed: string, config: EncounterMapGeneratorConfig) {
    return generateEncounterLayout(passRng(seed, 'layout', generateConfigHash(seed, config)), config)
  }

  private generateDoorsPass(seed: string, config: EncounterMapGeneratorConfig, map: Pick<EncounterMapData, 'corridors' | 'flow'>) {
    const rng = passRng(seed, 'doors', generateConfigHash(seed, config))
    const doors: EncounterMapData['doors'] = []
    if (config.mapType === 'FOREST') return { doors, changedCounts: { doors: 0 } }
    const route = new Set(map.flow?.routeRoomIds ?? [])
    for (const corridor of map.corridors) {
      if (corridor.points.length < 2) continue
      const critical = route.has(corridor.fromRoomId) && route.has(corridor.toRoomId)
      // Building passages cross one shared wall, so they contain one doorway.
      const endpoints = config.mapType === 'BUILDING' ? [corridor.points[0]!] : [corridor.points[0]!, corridor.points.at(-1)!]
      for (const point of endpoints) {
        if (rng() > config.doors.doorFrequency) continue
        doors.push({
          id: `door-${doors.length + 1}`,
          x: point.x,
          y: point.y,
          corridorId: corridor.id,
          isLocked: rng() < config.doors.lockedDoorChance,
          isSecret: !critical && rng() < config.doors.secretDoorChance,
          isSpecial: rng() < config.doors.specialDoorChance,
        })
      }
    }
    return { doors, changedCounts: { doors: doors.length } }
  }

  private generateTrapsPass(seed: string, config: EncounterMapGeneratorConfig, map: ContentMap) {
    const rng = passRng(seed, 'traps', generateConfigHash(seed, config))
    const singleTarget = config.encounterScale === 'SINGLE' ? singleEncounterTarget(map) : undefined
    const traps = map.rooms
      .filter(room => (room.kind !== 'HALL' && room.kind !== 'STAIRWELL' || room.id === singleTarget) && room.id !== map.flow?.entryRoomId && room.id !== map.flow?.exitRoomId
        && (config.encounterScale !== 'SINGLE' || room.id === singleTarget) && rng() < config.content.trapDensity)
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
        } satisfies EncounterMapData['traps'][number]
      })
    return { traps, changedCounts: { traps: traps.length } }
  }

  private generateEncountersPass(seed: string, config: EncounterMapGeneratorConfig, map: ContentMap) {
    const rng = passRng(seed, 'encounters', generateConfigHash(seed, config))
    const objectiveId = config.encounterScale === 'SINGLE' ? singleEncounterTarget(map) : map.flow?.objectiveRoomId
    const route = map.flow?.routeRoomIds ?? []
    const encounterRooms = map.rooms.filter(room => room.kind !== 'HALL' && room.kind !== 'STAIRWELL'
      && room.id !== map.flow?.entryRoomId && room.id !== map.flow?.exitRoomId)
    const challengeId = route.find(id => encounterRooms.some(room => room.id === id) && id !== objectiveId)
      ?? route.slice(1).find(id => id !== objectiveId && id !== map.flow?.exitRoomId && map.rooms.some(room => room.id === id && room.kind === 'HALL'))
    const encounters = map.rooms
      .filter(room => config.content.encounterDensity > 0 && (encounterRooms.includes(room) || room.id === challengeId || room.id === objectiveId)
        && (config.encounterScale !== 'SINGLE' || room.id === objectiveId)
        && (room.id === objectiveId || room.id === challengeId || rng() < config.content.encounterDensity))
      .map((room) => {
        const objective = room.id === objectiveId
        const challenge = room.id === challengeId
        const position = route.indexOf(room.id)
        const difficulty = objective ? 'HARD' : challenge || position > route.length / 2 ? 'MEDIUM' : 'EASY'
        return {
          id: `encounter-${room.id}`,
          roomId: room.id,
          title: `${room.label ?? `Room ${room.roomNumber}`}: ${objective ? 'Final confrontation' : challenge ? 'Guarded approach' : 'Patrol'}`,
          difficulty,
          summary: objective ? 'Defenders hold the main reward and the way onward. This is the final confrontation before the escape route.'
            : challenge ? 'An alert guard force controls the approach. Resolve this challenge to reach the inner areas.'
              : 'A smaller patrol provides pressure or an optional encounter away from the main confrontation.',
          isLocked: false,
        } satisfies EncounterMapData['encounters'][number]
      })
    return { encounters, changedCounts: { encounters: encounters.length } }
  }

  private generateTreasurePass(seed: string, config: EncounterMapGeneratorConfig, map: ContentMap) {
    const rng = passRng(seed, 'treasure', generateConfigHash(seed, config))
    const objectiveId = config.encounterScale === 'SINGLE' ? singleEncounterTarget(map) : map.flow?.objectiveRoomId
    const treasures = map.rooms
      .filter(room => config.content.treasureDensity > 0 && (room.kind !== 'HALL' && room.kind !== 'STAIRWELL' || room.id === objectiveId)
        && (config.encounterScale !== 'SINGLE' || room.id === objectiveId)
        && room.id !== map.flow?.entryRoomId && room.id !== map.flow?.exitRoomId
        && (room.id === objectiveId || rng() < config.content.treasureDensity))
      .map((room) => {
        const objective = room.id === objectiveId
        const rarity = objective ? 'UNCOMMON' : rng() < 0.1 ? 'VERY_RARE' : rng() < 0.25 ? 'RARE' : rng() < 0.55 ? 'UNCOMMON' : 'COMMON'
        const category = rng() < 0.2 ? 'MAGIC' : rng() < 0.5 ? 'ITEM' : rng() < 0.75 ? 'ART' : 'COIN'
        return {
          id: `treasure-${room.id}`,
          roomId: room.id,
          category,
          rarity,
          summary: objective ? `The guarded cache in ${room.label ?? 'this chamber'} holds the encounter's main reward.` : `${rarity.replace('_', ' ')} ${category.toLowerCase()} cache.`,
          isLocked: false,
        } satisfies EncounterMapData['treasures'][number]
      })
    return { treasures, changedCounts: { treasure: treasures.length } }
  }

  private generateDressingPass(seed: string, config: EncounterMapGeneratorConfig, map: Pick<EncounterMapData, 'rooms'>) {
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

  generateBaseMap(seed: string, config: EncounterMapGeneratorConfig): EncounterMapData {
    const configHash = generateConfigHash(seed, config)
    const startedAt = new Date().toISOString()
    const layout = this.generateLayoutPass(seed, config)
    const doors = this.generateDoorsPass(seed, config, layout)
    const traps = this.generateTrapsPass(seed, config, layout)
    const encounters = this.generateEncountersPass(seed, config, layout)
    const treasure = this.generateTreasurePass(seed, config, layout)
    const dressing = this.generateDressingPass(seed, config, { rooms: layout.rooms })
    const finishedAt = new Date().toISOString()

    const map: EncounterMapData = {
      schemaVersion: 1,
      mapType: config.mapType,
      floorCount: config.floorCount,
      terrain: layout.terrain,
      stairs: layout.stairs,
      portals: layout.portals,
      flow: layout.flow,
      ...(layout.floorLabels ? { floorLabels: layout.floorLabels } : {}),
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
        algorithmVersion: ENCOUNTER_MAP_GENERATOR_VERSION,
        configHash,
        generatedAt: finishedAt,
        seed,
        passHistory: [],
      },
    }

    return withPassHistory(map, {
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
    })
  }

  regenerate(
    scope: CampaignEncounterMapRegenerateScope,
    seed: string,
    config: EncounterMapGeneratorConfig,
    existingMap: EncounterMapData,
    options: { preserveLocks?: boolean } = {},
  ) {
    const preserveLocks = options.preserveLocks ?? true
    const configHash = generateConfigHash(seed, config)
    const startedAt = new Date().toISOString()

    if (scope === 'FULL' || scope === 'LAYOUT') {
      const rebuilt = this.generateBaseMap(seed, config)
      return withPassHistory(rebuilt, {
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
      })
    }

    let content: Partial<Pick<EncounterMapData, 'doors' | 'traps' | 'encounters' | 'treasures'>>
    let changedCounts: EncounterMapPassHistoryEntry['changedCounts']
    if (scope === 'DOORS') {
      const generatedDoors = this.generateDoorsPass(seed, { ...config, mapType: existingMap.mapType ?? 'DUNGEON' }, existingMap).doors
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
      content = { doors }
      changedCounts = { doors: doors.length }
    } else if (scope === 'TRAPS') {
      const generated = this.generateTrapsPass(seed, config, existingMap).traps
      const traps = preserveRoomContent(generated, existingMap.traps, preserveLocks, existingMap.rooms)
      content = { traps }
      changedCounts = { traps: traps.length }
    } else if (scope === 'ENCOUNTERS') {
      const generated = this.generateEncountersPass(seed, config, existingMap).encounters
      const encounters = preserveRoomContent(generated, existingMap.encounters, preserveLocks, existingMap.rooms)
      content = { encounters }
      changedCounts = { encounters: encounters.length }
    } else {
      const generated = this.generateTreasurePass(seed, config, existingMap).treasures
      const treasures = preserveRoomContent(generated, existingMap.treasures, preserveLocks, existingMap.rooms)
      content = { treasures }
      changedCounts = { treasure: treasures.length }
    }

    return withPassHistory(
      {
        ...existingMap,
        ...content,
        metadata: {
          ...existingMap.metadata,
          algorithmVersion: ENCOUNTER_MAP_GENERATOR_VERSION,
          configHash,
          generatedAt: new Date().toISOString(),
          seed,
        },
      },
      {
        pass: scope,
        scope,
        seed,
        configHash,
        startedAt,
        changedCounts,
      },
    )
  }
}
