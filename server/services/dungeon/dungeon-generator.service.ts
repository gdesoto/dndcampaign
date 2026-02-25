import { createHash } from 'node:crypto'
import type { CampaignDungeonRegenerateScope, DungeonGeneratorConfig, DungeonMapData } from '#shared/types/dungeon'
import { createPassHistoryEntry, withHistoryEntry } from './dungeon-map-utils'

const DUNGEON_GENERATOR_VERSION = '1.2.0'

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

const centerOf = (room: DungeonMapData['rooms'][number]) => ({
  x: room.x + Math.floor(room.width / 2),
  y: room.y + Math.floor(room.height / 2),
})

const toOdd = (value: number, direction: 'up' | 'down' = 'up') => {
  if (value % 2 === 1) return value
  return direction === 'up' ? value + 1 : value - 1
}

const randomOddInRange = (rng: SeededRng, minInclusive: number, maxInclusive: number) => {
  const minOdd = toOdd(minInclusive, 'up')
  const maxOdd = toOdd(maxInclusive, 'down')
  if (minOdd > maxOdd) return minOdd
  const count = Math.floor((maxOdd - minOdd) / 2) + 1
  return minOdd + (randomInt(rng, 0, Math.max(0, count - 1)) * 2)
}

const roomAnchorToward = (
  room: DungeonMapData['rooms'][number],
  target: { x: number; y: number },
) => {
  const center = centerOf(room)
  const dx = target.x - center.x
  const dy = target.y - center.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? room.x + room.width - 1 : room.x,
      y: center.y,
    }
  }
  return {
    x: center.x,
    y: dy >= 0 ? room.y + room.height - 1 : room.y,
  }
}

const dedupePoints = (points: Array<{ x: number; y: number }>) =>
  points.filter((point, index) => index === 0 || point.x !== points[index - 1]!.x || point.y !== points[index - 1]!.y)

const compressOrthogonalPath = (points: Array<{ x: number; y: number }>) => {
  if (points.length <= 2) return points
  const out: Array<{ x: number; y: number }> = [points[0]!]
  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1]!
    const current = points[index]!
    const next = points[index + 1]!
    const sameX = prev.x === current.x && current.x === next.x
    const sameY = prev.y === current.y && current.y === next.y
    if (!sameX && !sameY) out.push(current)
  }
  out.push(points[points.length - 1]!)
  return out
}

const corridorPathIsValid = (points: Array<{ x: number; y: number }>, rooms: DungeonMapData['rooms']) =>
  points.every((point) => rooms.every((room) =>
    !(point.x > room.x && point.x < room.x + room.width - 1 && point.y > room.y && point.y < room.y + room.height - 1)))

const clampPointToMap = (point: { x: number; y: number }, config: DungeonGeneratorConfig) => ({
  x: clamp(point.x, 0, config.width - 1),
  y: clamp(point.y, 0, config.height - 1),
})

const stepOutsideRoom = (
  room: DungeonMapData['rooms'][number],
  anchor: { x: number; y: number },
) => {
  const center = centerOf(room)
  if (anchor.x >= room.x + room.width - 1) return { x: anchor.x + 1, y: anchor.y }
  if (anchor.x <= room.x) return { x: anchor.x - 1, y: anchor.y }
  if (anchor.y >= room.y + room.height - 1) return { x: anchor.x, y: anchor.y + 1 }
  if (anchor.y <= room.y) return { x: anchor.x, y: anchor.y - 1 }
  // Fallback: move away from room center.
  if (Math.abs(anchor.x - center.x) >= Math.abs(anchor.y - center.y)) {
    return { x: anchor.x + (anchor.x >= center.x ? 1 : -1), y: anchor.y }
  }
  return { x: anchor.x, y: anchor.y + (anchor.y >= center.y ? 1 : -1) }
}

const buildBlockedCells = (
  rooms: DungeonMapData['rooms'],
  width: number,
  height: number,
  allowedCells: Array<{ x: number; y: number }>,
) => {
  const blocked = new Uint8Array(width * height)
  const allow = new Set(allowedCells.map((cell) => `${cell.x}:${cell.y}`))
  for (const room of rooms) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      for (let y = room.y; y < room.y + room.height; y += 1) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue
        if (allow.has(`${x}:${y}`)) continue
        blocked[(y * width) + x] = 1
      }
    }
  }
  return blocked
}

const findCellPath = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  width: number,
  height: number,
  blocked: Uint8Array,
  style: DungeonGeneratorConfig['layout']['corridorStyle'],
  rng: SeededRng,
) => {
  const startIndex = (start.y * width) + start.x
  const endIndex = (end.y * width) + end.x
  const visited = new Uint8Array(width * height)
  const previous = new Int32Array(width * height)
  previous.fill(-1)
  const queue: number[] = [startIndex]
  visited[startIndex] = 1

  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]
  const chooseOrder = (cx: number, cy: number) => {
    const target = { x: end.x - cx, y: end.y - cy }
    const scored = directions.map((dir) => {
      const manhattanAfter = Math.abs(target.x - dir.x) + Math.abs(target.y - dir.y)
      return { dir, manhattanAfter }
    })
    if (style === 'WINDING' || (style === 'MIXED' && rng() < 0.35)) {
      return [...scored].sort(() => (rng() < 0.5 ? -1 : 1)).map((entry) => entry.dir)
    }
    return scored.sort((a, b) => a.manhattanAfter - b.manhattanAfter).map((entry) => entry.dir)
  }

  while (queue.length) {
    const current = queue.shift()!
    if (current === endIndex) break
    const cx = current % width
    const cy = Math.floor(current / width)
    for (const dir of chooseOrder(cx, cy)) {
      const nx = cx + dir.x
      const ny = cy + dir.y
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const next = (ny * width) + nx
      if (blocked[next] || visited[next]) continue
      visited[next] = 1
      previous[next] = current
      queue.push(next)
    }
  }

  if (!visited[endIndex]) return null
  const path: Array<{ x: number; y: number }> = []
  let cursor = endIndex
  while (cursor >= 0) {
    path.push({ x: cursor % width, y: Math.floor(cursor / width) })
    if (cursor === startIndex) break
    cursor = previous[cursor]!
  }
  return path.reverse()
}

const routeCorridorPoints = (
  rng: SeededRng,
  fromRoom: DungeonMapData['rooms'][number],
  toRoom: DungeonMapData['rooms'][number],
  rooms: DungeonMapData['rooms'],
  config: DungeonGeneratorConfig,
) => {
  const toCenter = centerOf(toRoom)
  const fromCenter = centerOf(fromRoom)
  const start = clampPointToMap(roomAnchorToward(fromRoom, toCenter), config)
  const end = clampPointToMap(roomAnchorToward(toRoom, fromCenter), config)
  const startOuter = clampPointToMap(stepOutsideRoom(fromRoom, start), config)
  const endOuter = clampPointToMap(stepOutsideRoom(toRoom, end), config)
  const blocked = buildBlockedCells(rooms, config.width, config.height, [start, end, startOuter, endOuter])
  const cellPath = findCellPath(
    startOuter,
    endOuter,
    config.width,
    config.height,
    blocked,
    config.layout.corridorStyle,
    rng,
  )
  if (!cellPath?.length) {
    return dedupePoints([{ ...start }, { ...startOuter }, { ...endOuter }, { ...end }])
  }
  const merged = dedupePoints([{ ...start }, ...cellPath, { ...end }]).map((point) => clampPointToMap(point, config))
  const compressed = compressOrthogonalPath(merged)
  if (corridorPathIsValid(compressed, rooms)) return compressed
  return merged
}

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
    const avgRoomSize = (config.layout.minRoomSize + config.layout.maxRoomSize) / 2
    const avgRoomArea = Math.max(9, avgRoomSize * avgRoomSize)
    const targetRooms = clamp(
      Math.floor((area * config.layout.roomDensity) / (avgRoomArea * 1.8)),
      8,
      220,
    )
    const maxAttempts = targetRooms * 40

    const rooms: DungeonMapData['rooms'] = []
    let attempts = 0

    while (rooms.length < targetRooms && attempts < maxAttempts) {
      attempts += 1
      const width = randomOddInRange(rng, config.layout.minRoomSize, config.layout.maxRoomSize)
      const height = randomOddInRange(rng, config.layout.minRoomSize, config.layout.maxRoomSize)
      if (width >= config.width - 2 || height >= config.height - 2) continue

      const x = randomOddInRange(rng, 1, Math.max(1, config.width - width - 1))
      const y = randomOddInRange(rng, 1, Math.max(1, config.height - height - 1))
      const isSecret = rng() < config.layout.secretRoomChance

      const candidate = { x, y, width, height }
      const roomPadding = config.layout.roomDensity >= 0.3 ? 0 : 1
      if (rooms.some((room) => overlaps(candidate, room, roomPadding))) continue
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
    const corridors: DungeonMapData['corridors'] = []
    const roomById = new Map(sortedRooms.map((room) => [room.id, room]))
    const centers = sortedRooms.map((room) => ({ roomId: room.id, ...centerOf(room) }))
    const candidateEdges: Array<{ fromRoomId: string; toRoomId: string; distance: number }> = []
    for (let i = 0; i < centers.length; i += 1) {
      for (let j = i + 1; j < centers.length; j += 1) {
        const a = centers[i]!
        const b = centers[j]!
        const distance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
        candidateEdges.push({ fromRoomId: a.roomId, toRoomId: b.roomId, distance })
      }
    }
    candidateEdges.sort((a, b) => a.distance - b.distance)

    const connected = new Set<string>([sortedRooms[0]!.id])
    const selectedEdges: Array<{ fromRoomId: string; toRoomId: string }> = []
    while (connected.size < sortedRooms.length) {
      const next = candidateEdges.find((edge) =>
        (connected.has(edge.fromRoomId) && !connected.has(edge.toRoomId))
        || (connected.has(edge.toRoomId) && !connected.has(edge.fromRoomId)),
      )
      if (!next) break
      selectedEdges.push({ fromRoomId: next.fromRoomId, toRoomId: next.toRoomId })
      connected.add(next.fromRoomId)
      connected.add(next.toRoomId)
    }

    const selectedEdgeKey = new Set(selectedEdges.map((edge) => `${edge.fromRoomId}:${edge.toRoomId}`))
    const extraTarget = Math.floor((sortedRooms.length - 1) * config.layout.connectivityStrictness * 0.65)
    let addedExtra = 0
    for (const candidate of candidateEdges) {
      if (addedExtra >= extraTarget) break
      const key = `${candidate.fromRoomId}:${candidate.toRoomId}`
      const reverseKey = `${candidate.toRoomId}:${candidate.fromRoomId}`
      if (selectedEdgeKey.has(key) || selectedEdgeKey.has(reverseKey)) continue
      if (rng() > (0.25 + (config.layout.connectivityStrictness * 0.6))) continue
      selectedEdges.push({ fromRoomId: candidate.fromRoomId, toRoomId: candidate.toRoomId })
      selectedEdgeKey.add(key)
      addedExtra += 1
    }

    for (let index = 0; index < selectedEdges.length; index += 1) {
      const edge = selectedEdges[index]!
      const from = roomById.get(edge.fromRoomId)
      const to = roomById.get(edge.toRoomId)
      if (!from || !to) continue
      const points = routeCorridorPoints(rng, from, to, rooms, config)
      corridors.push({
        id: `corridor-${index + 1}`,
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
