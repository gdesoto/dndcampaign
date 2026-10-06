import type { EncounterMapGeneratorConfig, EncounterMapData, EncounterMapPortal, EncounterMapRoomGeometry, EncounterMapTerrainFeature } from '../../../shared/types/encounter-map'

type Point = { x: number; y: number }
type Side = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST'
type Layout = Pick<EncounterMapData, 'rooms' | 'corridors' | 'terrain' | 'stairs' | 'portals' | 'flow'>
type AccessMap = Pick<EncounterMapData, 'width' | 'height' | 'rooms' | 'corridors' | 'portals' | 'terrain'>
const sides: Side[] = ['NORTH', 'EAST', 'SOUTH', 'WEST']
const inside = (point: Point, area: Point & { width: number; height: number }) =>
  point.x >= area.x && point.y >= area.y && point.x < area.x + area.width && point.y < area.y + area.height
const center = (room: EncounterMapRoomGeometry): Point => ({ x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) })
const key = (point: Point) => `${point.x}:${point.y}`

export const pathCells = (points: Point[]) => {
  const cells: Point[] = []
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!
    const end = points[index]!
    const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
    for (let step = 0; step <= length; step += 1) cells.push({ x: start.x + Math.sign(end.x - start.x) * step, y: start.y + Math.sign(end.y - start.y) * step })
  }
  return cells
}

const wallStarts = (room: EncounterMapRoomGeometry, side: Side) => {
  const vertical = side === 'NORTH' || side === 'SOUTH'
  const length = vertical ? room.width : room.height
  return Array.from({ length }, (_, offset) => vertical
    ? { x: room.x + offset, y: side === 'NORTH' ? room.y : room.y + room.height - 1 }
    : { x: side === 'WEST' ? room.x : room.x + room.width - 1, y: room.y + offset })
    .sort((a, b) => Math.abs(a.x - center(room).x) + Math.abs(a.y - center(room).y) - Math.abs(b.x - center(room).x) - Math.abs(b.y - center(room).y))
}
const outward = (point: Point, side: Side): Point => ({ x: point.x + (side === 'EAST' ? 1 : side === 'WEST' ? -1 : 0), y: point.y + (side === 'SOUTH' ? 1 : side === 'NORTH' ? -1 : 0) })
const boundary = (point: Point, side: Side, map: AccessMap) => side === 'NORTH' ? point.y === 0 : side === 'SOUTH' ? point.y === map.height - 1 : side === 'WEST' ? point.x === 0 : point.x === map.width - 1

const accessMask = (map: AccessMap, room: EncounterMapRoomGeometry, existingPortalId?: string) => {
  const blocked = new Uint8Array(map.width * map.height)
  const mark = (point: Point) => {
    if (point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height) blocked[point.y * map.width + point.x] = 1
  }
  for (const other of map.rooms.filter(item => (item.floor ?? 0) === (room.floor ?? 0))) {
    for (let x = other.x; x < other.x + other.width; x += 1) for (let y = other.y; y < other.y + other.height; y += 1) mark({ x, y })
  }
  const roomById = new Map(map.rooms.map(item => [item.id, item]))
  const paths = [
    ...map.corridors.filter(path => (roomById.get(path.fromRoomId)?.floor ?? 0) === (room.floor ?? 0)),
    ...(map.portals ?? []).filter(path => path.id !== existingPortalId && (roomById.get(path.roomId)?.floor ?? 0) === (room.floor ?? 0)),
  ]
  for (const path of paths) {
    for (const point of pathCells(path.points)) {
      // Keep an empty cell between approaches outside their destination rooms;
      // merely avoiding identical coordinates would still join adjacent routes.
      const clearance = inside(point, room) ? 0 : 1
      for (let x = point.x - clearance; x <= point.x + clearance; x += 1) for (let y = point.y - clearance; y <= point.y + clearance; y += 1) mark({ x, y })
    }
  }
  for (const feature of (map.terrain ?? []).filter(item => (item.floor ?? 0) === (room.floor ?? 0))) {
    for (let x = feature.x; x < feature.x + feature.width; x += 1) for (let y = feature.y; y < feature.y + feature.height; y += 1) mark({ x, y })
  }
  return blocked
}

const simplify = (points: Point[]) => points.filter((point, index) => index === 0 || index === points.length - 1
  || (points[index - 1]!.x === point.x) !== (points[index + 1]!.x === point.x))

/** Route an exterior entrance without punching through another room or passage. */
export const routePortalToEdge = (map: AccessMap, roomId: string, side: Side, existingPortalId?: string): Point[] | null => {
  const room = map.rooms.find(item => item.id === roomId)
  if (!room) return null
  const blocked = accessMask(map, room, existingPortalId)
  const valid = (point: Point) => point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height && !blocked[point.y * map.width + point.x]
  const occupiedDoors = [
    ...map.corridors.flatMap(path => path.fromRoomId === roomId ? [path.points[0]!] : path.toRoomId === roomId ? [path.points.at(-1)!] : []),
    ...(map.portals ?? []).filter(path => path.id !== existingPortalId && path.roomId === roomId).map(path => path.points[0]!),
  ]
  const clearStart = (point: Point) => !occupiedDoors.some(door => door.x === point.x && door.y === point.y)
    && !(map.terrain ?? []).some(feature => (feature.floor ?? 0) === (room.floor ?? 0) && inside(point, feature))
  // Favor a direct approach on the requested face before considering a bend.
  for (const start of wallStarts(room, side)) {
    if (!clearStart(start)) continue
    if (boundary(start, side, map)) return [start, start]
    let point = outward(start, side)
    while (valid(point)) {
      if (boundary(point, side, map)) return [start, point]
      point = outward(point, side)
    }
  }
  const queue: number[] = []
  const parent = new Int32Array(blocked.length).fill(-2)
  const origins = new Map<number, Point>()
  for (const face of [side, ...sides.filter(item => item !== side)]) {
    for (const start of wallStarts(room, face)) {
      if (!clearStart(start)) continue
      const point = outward(start, face)
      if (!valid(point)) continue
      const index = point.y * map.width + point.x
      if (parent[index] !== -2) continue
      parent[index] = -1
      origins.set(index, start)
      queue.push(index)
    }
  }
  for (let offset = 0; offset < queue.length; offset += 1) {
    const index = queue[offset]!
    const point = { x: index % map.width, y: Math.floor(index / map.width) }
    if (boundary(point, side, map)) {
      const path = [point]
      let cursor = index
      while (parent[cursor] !== -1) {
        cursor = parent[cursor]!
        path.push({ x: cursor % map.width, y: Math.floor(cursor / map.width) })
      }
      path.push(origins.get(cursor)!)
      return simplify(path.reverse())
    }
    for (const next of sides.map(face => outward(point, face))) {
      if (!valid(next)) continue
      const nextIndex = next.y * map.width + next.x
      if (parent[nextIndex] !== -2) continue
      parent[nextIndex] = index
      queue.push(nextIndex)
    }
  }
  return null
}

const addAccessPoints = (rng: () => number, config: EncounterMapGeneratorConfig, layout: Layout) => {
  const settings = config.accessPoints
  const portals = layout.portals ??= []
  const ground = layout.rooms.find(room => room.id === layout.flow?.entryRoomId)?.floor ?? 0
  const candidates = layout.rooms.filter(room => !room.isSecret && (room.floor ?? 0) === ground && room.kind !== 'STAIRWELL' && room.kind !== 'BALCONY')
  const requests: Array<{ kind: EncounterMapPortal['kind']; secret: boolean }> = [
    ...Array.from({ length: Math.max(0, settings.entrances - portals.filter(portal => portal.kind === 'ENTRANCE' && !portal.isSecret).length) }, () => ({ kind: 'ENTRANCE' as const, secret: false })),
    ...Array.from({ length: Math.max(0, settings.exits - portals.filter(portal => portal.kind === 'EXIT').length) }, () => ({ kind: 'EXIT' as const, secret: false })),
    ...(settings.concealedEntrance && !portals.some(portal => portal.isSecret) ? [{ kind: 'ENTRANCE' as const, secret: true }] : []),
  ]
  for (const request of requests) {
    const choices = candidates.flatMap(room => sides.map(side => ({ room, side,
      priority: portals.some(portal => portal.roomId === room.id) ? 100 : 0,
      tie: rng(),
    }))).sort((a, b) => a.priority - b.priority || a.tie - b.tie)
    let selected: { room: EncounterMapRoomGeometry; points: Point[]; score: number } | undefined
    for (const choice of choices) {
      // Forest vegetation is carved after routing, like the primary trails. Rooms
      // and existing routes remain obstacles, so a back door cannot create a shortcut.
      const map = { ...layout, width: config.width, height: config.height, terrain: [] }
      const points = routePortalToEdge(map, choice.room.id, choice.side)
      if (!points) continue
      const end = points.at(-1)!
      const spacing = Math.min(...portals.map(portal => {
        const other = portal.points.at(-1)!
        return Math.abs(end.x - other.x) + Math.abs(end.y - other.y)
      }))
      const length = pathCells(points).length
      const score = spacing - choice.priority - length * 0.25 + choice.tie
      if (!selected || score > selected.score) selected = { room: choice.room, points, score }
      // Large sites have many interior rooms; an adequately separated direct
      // boundary opening is already a useful alternate approach.
      if (points.length === 2 && spacing >= 5 && choice.priority === 0) break
    }
    if (!selected) throw new Error('No clear exterior route is available for the requested access points.')
    portals.push({ id: `portal-${request.secret ? 'concealed' : request.kind.toLowerCase()}-${portals.length + 1}`, kind: request.kind, roomId: selected.room.id,
      isSecret: request.secret, label: request.secret ? 'Concealed approach' : request.kind === 'EXIT' ? 'Escape route' : config.mapType === 'BUILDING' ? 'Side entrance' : 'Alternate approach', points: selected.points })
  }
  const approaches = portals.flatMap(portal => pathCells(portal.points))
  layout.terrain = (layout.terrain ?? []).filter(feature => (feature.floor ?? 0) !== ground || !approaches.some(point =>
    point.x >= feature.x - 1 && point.x <= feature.x + feature.width && point.y >= feature.y - 1 && point.y <= feature.y + feature.height))
}

const populateTactics = (rng: () => number, config: EncounterMapGeneratorConfig, layout: Layout) => {
  const settings = config.tacticalTerrain
  const terrain = layout.terrain ??= []
  for (const feature of terrain) {
    feature.blocksMovement = feature.kind === 'TREE' || feature.kind === 'ROCK'
    feature.blocksSight = settings.sightlines !== 'OPEN' && (feature.kind === 'TREE' || settings.sightlines === 'BROKEN' && feature.kind === 'ROCK')
  }
  const forest = config.mapType === 'FOREST'
  const building = config.mapType === 'BUILDING'
  const rooms = layout.rooms.filter(room => !room.isSecret && room.kind !== 'HALL' && room.kind !== 'STAIRWELL' && room.kind !== 'BALCONY')
    .sort((a, b) => Number(b.id === layout.flow?.objectiveRoomId) - Number(a.id === layout.flow?.objectiveRoomId) || b.width * b.height - a.width * a.height)
  const placedKinds = new Set<EncounterMapTerrainFeature['kind']>()
  for (const room of rooms) {
    const reserved = new Set<string>()
    const endpoints = [
      ...layout.corridors.flatMap(corridor => corridor.fromRoomId === room.id ? [corridor.points[0]!] : corridor.toRoomId === room.id ? [corridor.points.at(-1)!] : []),
      ...(layout.portals ?? []).filter(portal => portal.roomId === room.id).map(portal => portal.points[0]!),
    ]
    const reserve = (point: Point, clearance = 0) => {
      for (let x = point.x - clearance; x <= point.x + clearance; x += 1) for (let y = point.y - clearance; y <= point.y + clearance; y += 1) reserved.add(key({ x, y }))
    }
    const middle = center(room)
    reserve(middle)
    // A clear internal spine joins every doorway. Cover can shape its sides, but
    // no obstacle can partition the room or consume a doorway's landing.
    for (const endpoint of endpoints) {
      reserve(endpoint, 1)
      for (const point of pathCells([endpoint, { x: middle.x, y: endpoint.y }, middle])) reserve(point)
    }
    for (const stair of layout.stairs ?? []) {
      if (stair.fromRoomId !== room.id && stair.toRoomId !== room.id) continue
      for (let x = stair.x - 1; x <= stair.x + (stair.width ?? 1); x += 1) for (let y = stair.y - 1; y <= stair.y + (stair.height ?? 1); y += 1) reserve({ x, y })
    }
    const available = Array.from({ length: room.width * room.height }, (_, index) => ({ x: room.x + index % room.width, y: room.y + Math.floor(index / room.width), tie: rng() }))
      .filter(point => !reserved.has(key(point)))
      .sort((a, b) => a.tie - b.tie)
    const objective = room.id === layout.flow?.objectiveRoomId
    const approach = room.id === layout.flow?.routeRoomIds[1]
    const priorityKinds: EncounterMapTerrainFeature['kind'][] = [
      ...(settings.elevation && (objective || !placedKinds.has('ELEVATION') || rng() < 0.25) ? ['ELEVATION' as const] : []),
      ...(settings.difficultTerrain && (objective || approach || !placedKinds.has('DIFFICULT') || rng() < 0.35) ? ['DIFFICULT' as const] : []),
      ...(settings.hazards && (objective || !placedKinds.has('HAZARD') || room.id !== layout.flow?.entryRoomId && rng() < 0.2) ? ['HAZARD' as const] : []),
    ].sort((a, b) => Number(placedKinds.has(a)) - Number(placedKinds.has(b)))
    const coverCount = settings.cover === 'NONE' ? 0 : settings.cover === 'HEAVY'
      ? Math.max(2, Math.floor(room.width * room.height / 18)) : Math.max(1, Math.floor(room.width * room.height / 60))
    const kinds = [...priorityKinds, ...Array.from({ length: coverCount + (settings.cover !== 'NONE' && settings.sightlines === 'BROKEN' ? 1 : 0) }, () => 'COVER' as const)]
    for (const kind of kinds) {
      const point = available.find(item => !reserved.has(key(item)))
      if (!point) break
      const blocksMovement = kind === 'COVER'
      const blocksSight = kind === 'COVER' && settings.sightlines !== 'OPEN' && (settings.sightlines === 'BROKEN' || rng() < 0.35)
      const label = kind === 'COVER' ? forest ? blocksSight ? 'Boulder' : 'Log' : building ? blocksSight ? 'Shelves' : 'Crates' : blocksSight ? 'Pillar' : 'Rubble'
        : kind === 'ELEVATION' ? forest ? 'Ledge' : 'Platform'
          : kind === 'DIFFICULT' ? forest ? 'Mud' : 'Debris'
            : forest ? 'Thorns' : building ? 'Brazier' : 'Fissure'
      const feature: EncounterMapTerrainFeature = {
        id: `tactical-${terrain.length + 1}`, kind, roomId: room.id, floor: room.floor ?? 0,
        x: point.x, y: point.y, width: 1, height: 1, label, blocksMovement, blocksSight,
        ...(kind === 'ELEVATION' ? { elevationFeet: forest ? 10 : 5 } : {}),
      }
      // Larger clearings and chambers get a usable ledge or patch, while narrow
      // rooms retain a single-cell tactical position beside their circulation.
      if (kind !== 'COVER' && room.width >= 7 && inside({ x: point.x + 1, y: point.y }, room) && !reserved.has(key({ x: point.x + 1, y: point.y }))) feature.width = 2
      terrain.push(feature)
      placedKinds.add(kind)
      for (let x = feature.x; x < feature.x + feature.width; x += 1) reserve({ x, y: feature.y }, blocksMovement ? 1 : 0)
    }
  }
}

export const populateEncounterFeatures = (rng: () => number, config: EncounterMapGeneratorConfig, layout: Layout): void => {
  addAccessPoints(rng, config, layout)
  populateTactics(rng, config, layout)
  if (config.verticalConnections.bridges && !layout.corridors.some(corridor => corridor.kind === 'BRIDGE')) {
    const roomById = new Map(layout.rooms.map(room => [room.id, room]))
    const candidates = layout.corridors.map(corridor => ({ corridor, gap: new Set(pathCells(corridor.points).filter(point =>
      !inside(point, roomById.get(corridor.fromRoomId)!) && !inside(point, roomById.get(corridor.toRoomId)!)).map(key)).size }))
      .filter(item => item.gap >= 2).sort((a, b) => b.gap - a.gap)
    for (const bridge of config.mapType === 'BUILDING' ? candidates : candidates.slice(0, 1)) bridge.corridor.kind = 'BRIDGE'
  }
}
