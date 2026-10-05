import type { DungeonGeneratorConfig, DungeonMapData, DungeonRoomGeometry } from '../../../shared/types/dungeon'
import { generateBuildingLayout } from './building-layout'
import { populateEncounterFeatures } from './encounter-features'

type Point = { x: number; y: number }
type Slot = { column: number; row: number }
type Rng = () => number
type Layout = Pick<DungeonMapData, 'rooms' | 'corridors'> & {
  terrain: NonNullable<DungeonMapData['terrain']>
  stairs: NonNullable<DungeonMapData['stairs']>
  portals: NonNullable<DungeonMapData['portals']>
  flow: NonNullable<DungeonMapData['flow']>
  floorLabels?: string[]
}

const integer = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1))
const center = (room: DungeonRoomGeometry): Point => ({ x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) })
const slotKey = (slot: Slot) => `${slot.column}:${slot.row}`

const cellsOnPath = (points: Point[]) => {
  const cells: Point[] = []
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!
    const to = points[index]!
    const steps = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
    for (let step = 0; step <= steps; step += 1) {
      cells.push({ x: from.x + Math.sign(to.x - from.x) * step, y: from.y + Math.sign(to.y - from.y) * step })
    }
  }
  return cells
}

// The encounter graph comes first. Every edge joins neighboring reserved sites,
// so room placement cannot invent shortcuts across the planned encounter route.
const planEncounter = (rng: Rng, config: DungeonGeneratorConfig) => {
  const style = config.encounterFlow ?? 'BRANCHING'
  const scale = config.encounterScale ?? 'SEQUENCE'
  if (scale === 'SINGLE') {
    if (style === 'LINEAR') {
      const main = [{ column: 0, row: 0 }, { column: 1, row: 0 }, { column: 2, row: 0 }]
      return { style, columns: 3, rows: 1, main, sites: main, edges: [[main[0]!, main[1]!], [main[1]!, main[2]!]] as Array<[Slot, Slot]> }
    }
    const main = [{ column: 0, row: 0 }, { column: 1, row: 0 }, { column: 1, row: 1 }, { column: 2, row: 1 }]
    const flank = { column: 0, row: 1 }
    const edges: Array<[Slot, Slot]> = [[main[0]!, main[1]!], [main[1]!, main[2]!], [main[2]!, main[3]!], [flank, main[2]!]]
    if (style === 'LOOP') edges.push([main[0]!, flank])
    return { style, columns: 3, rows: 2, main, sites: [...main, flank], edges }
  }
  // Scale chooses the number of encounter areas. Canvas dimensions constrain
  // their fit and aspect ratio; enlarging the canvas does not add more fights.
  const density = config.mapType === 'FOREST' ? 0.25 : config.layout.roomDensity
  const target = scale === 'COMPLEX' ? 18 + Math.round(density * 24) : 6 + Math.round(density * 8)
  const maxSites = scale === 'COMPLEX' ? 42 : 12
  let columns = 3
  let rows = 2
  let best = Infinity
  for (let candidateColumns = 3; candidateColumns <= Math.min(Math.floor((config.width - 2) / 5), Math.floor(maxSites / 2)); candidateColumns += 1) {
    for (let candidateRows = 2; candidateRows <= Math.min(Math.floor((config.height - 2) / 5), Math.floor(maxSites / candidateColumns)); candidateRows += 1) {
      const count = candidateColumns * candidateRows
      const score = Math.abs(count - target) * 4 + Math.abs(Math.log((candidateColumns / candidateRows) / (config.width / config.height)))
      if (score < best) {
        best = score
        columns = candidateColumns
        rows = candidateRows
      }
    }
  }
  const main: Slot[] = []
  if (style === 'LINEAR') {
    for (let column = 0; column < columns; column += 1) {
      for (let index = 0; index < rows; index += 1) main.push({ column, row: column % 2 ? rows - index - 1 : index })
    }
  } else {
    // Entry -> guard/ambush -> inner junction -> objective -> escape. The lower
    // left site is reserved for the loop's alternate approach around the guard.
    main.push({ column: 0, row: 0 }, { column: 1, row: 0 })
    for (let row = 1; row < rows; row += 1) main.push({ column: 1, row })
    for (let column = 2; column < columns; column += 1) main.push({ column, row: rows - 1 })
    for (let row = rows - 2; row >= 0; row -= 1) main.push({ column: columns - 1, row })
  }
  const sites = [...main]
  const edges: Array<[Slot, Slot]> = main.slice(1).map((site, index) => [main[index]!, site])
  const placed = new Set(main.map(slotKey))
  if (style === 'LOOP') {
    const alternate = { column: 0, row: 1 }
    sites.push(alternate)
    placed.add(slotKey(alternate))
    edges.push([main[0]!, alternate], [alternate, main[2]!])
  }
  const remaining: Slot[] = []
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const slot = { column, row }
      if (!placed.has(slotKey(slot))) remaining.push(slot)
    }
  }
  while (remaining.length) {
    const frontier = remaining.flatMap(site => {
      const neighbors = sites.filter(other => Math.abs(other.column - site.column) + Math.abs(other.row - site.row) === 1)
      return neighbors.length ? [{ site, neighbors }] : []
    })
    const { site, neighbors } = frontier[integer(rng, 0, frontier.length - 1)]!
    edges.push([neighbors[integer(rng, 0, neighbors.length - 1)]!, site])
    sites.push(site)
    remaining.splice(remaining.indexOf(site), 1)
  }
  return { style, columns, rows, sites, main, edges }
}

const routeNeighbors = (rng: Rng, config: DungeonGeneratorConfig, from: DungeonRoomGeometry, to: DungeonRoomGeometry, a: Slot, b: Slot) => {
  const fromCenter = center(from)
  const toCenter = center(to)
  let points: Point[]
  const straight = config.mapType !== 'FOREST' && (config.layout.corridorStyle === 'STRAIGHT'
    || config.layout.corridorStyle === 'MIXED' && rng() < 0.5)
  if (a.row === b.row) {
    const rightward = a.column < b.column
    const start = { x: rightward ? from.x + from.width - 1 : from.x, y: fromCenter.y }
    const end = { x: rightward ? to.x : to.x + to.width - 1, y: toCenter.y }
    if (config.mapType === 'FOREST') {
      start.y = integer(rng, from.y + 1, from.y + from.height - 2)
      end.y = integer(rng, to.y + 1, to.y + to.height - 2)
    }
    const low = Math.max(from.y, to.y) + 1
    const high = Math.min(from.y + from.height, to.y + to.height) - 2
    if (straight && low <= high) start.y = end.y = integer(rng, low, high)
    const bendX = config.mapType === 'FOREST'
      ? integer(rng, Math.min(start.x, end.x) + 1, Math.max(start.x, end.x) - 1)
      : Math.floor((start.x + end.x) / 2)
    points = [start, { x: bendX, y: start.y }, { x: bendX, y: end.y }, end]
  } else {
    const downward = a.row < b.row
    const start = { x: fromCenter.x, y: downward ? from.y + from.height - 1 : from.y }
    const end = { x: toCenter.x, y: downward ? to.y : to.y + to.height - 1 }
    if (config.mapType === 'FOREST') {
      start.x = integer(rng, from.x + 1, from.x + from.width - 2)
      end.x = integer(rng, to.x + 1, to.x + to.width - 2)
    }
    const low = Math.max(from.x, to.x) + 1
    const high = Math.min(from.x + from.width, to.x + to.width) - 2
    if (straight && low <= high) start.x = end.x = integer(rng, low, high)
    const bendY = config.mapType === 'FOREST'
      ? integer(rng, Math.min(start.y, end.y) + 1, Math.max(start.y, end.y) - 1)
      : Math.floor((start.y + end.y) / 2)
    points = [start, { x: start.x, y: bendY }, { x: end.x, y: bendY }, end]
  }
  return points.filter((point, index, all) => index === 0 || point.x !== all[index - 1]!.x || point.y !== all[index - 1]!.y)
}

const placeEncounter = (rng: Rng, config: DungeonGeneratorConfig): Layout => {
  const plan = planEncounter(rng, config)
  const forest = config.mapType === 'FOREST'
  const footprintWidth = forest ? config.width - 2 : Math.min(config.width - 2, plan.columns * (config.layout.maxRoomSize + 3) - 1)
  const footprintHeight = forest ? config.height - 2 : Math.min(config.height - 2, plan.rows * (config.layout.maxRoomSize + 3) - 1)
  const originX = Math.floor((config.width - footprintWidth) / 2)
  const originY = Math.floor((config.height - footprintHeight) / 2)
  const labels = forest
    ? ['Old campsite', 'Rocky overlook', 'Fallen oak', 'Wildflower glade', 'Hunters shelter', 'Mossy hollow']
    : ['Barracks', 'Store room', 'Armory', 'Cistern', 'Workshop', 'Old shrine']
  const mainKeys = plan.main.map(slotKey)
  const rooms = plan.sites.map((site, index): DungeonRoomGeometry => {
    const left = originX + Math.floor(site.column * footprintWidth / plan.columns)
    const right = originX + Math.floor((site.column + 1) * footprintWidth / plan.columns)
    const top = originY + Math.floor(site.row * footprintHeight / plan.rows)
    const bottom = originY + Math.floor((site.row + 1) * footprintHeight / plan.rows)
    const maxWidth = Math.max(3, Math.min(config.layout.maxRoomSize, right - left - 2))
    const maxHeight = Math.max(3, Math.min(config.layout.maxRoomSize, bottom - top - 2))
    const mainIndex = mainKeys.indexOf(slotKey(site))
    const objective = mainIndex === plan.main.length - 2
    const challenge = mainIndex === 1
    const width = objective ? maxWidth : challenge ? Math.max(Math.min(config.layout.minRoomSize, maxWidth), Math.ceil(maxWidth * 0.8))
      : integer(rng, Math.min(config.layout.minRoomSize, maxWidth), maxWidth)
    const height = objective ? maxHeight : challenge ? Math.max(Math.min(config.layout.minRoomSize, maxHeight), Math.ceil(maxHeight * 0.8))
      : integer(rng, Math.min(config.layout.minRoomSize, maxHeight), maxHeight)
    const single = config.encounterScale === 'SINGLE'
    const label = mainIndex === 0 ? forest ? 'Near trailhead' : 'Entry chamber'
      : mainIndex === plan.main.length - 2 ? forest ? 'Ancient shrine' : 'Ritual chamber'
        : mainIndex === 1 ? single ? 'Covered approach' : forest ? 'Ambush clearing' : 'Guard post'
          : mainIndex === plan.main.length - 1 ? forest ? 'Far trailhead' : 'Escape chamber'
            : labels[index % labels.length]!
    return {
      id: `room-${index + 1}`, roomNumber: index + 1, floor: 0, kind: forest ? 'CLEARING' : single && !objective ? 'HALL' : 'ROOM', label, isSecret: false,
      x: integer(rng, left + 1, right - width - 1), y: integer(rng, top + 1, bottom - height - 1), width, height,
    }
  })
  const bySite = new Map(plan.sites.map((site, index) => [slotKey(site), rooms[index]!]))
  const corridors = plan.edges.map(([a, b], index) => {
    const from = bySite.get(slotKey(a))!
    const to = bySite.get(slotKey(b))!
    return { id: `corridor-${index + 1}`, fromRoomId: from.id, toRoomId: to.id, points: routeNeighbors(rng, config, from, to, a, b) }
  })
  const mainRooms = plan.main.map(site => bySite.get(slotKey(site))!)
  const entry = mainRooms[0]!
  const exit = mainRooms.at(-1)!
  const objective = mainRooms.at(-2)!
  const layout: Layout = {
    rooms, corridors, terrain: [], stairs: [],
    portals: [
      { id: 'portal-entrance', kind: 'ENTRANCE', roomId: entry.id, points: [{ x: entry.x, y: center(entry).y }, { x: 0, y: center(entry).y }] },
      { id: 'portal-exit', kind: 'EXIT', roomId: exit.id, points: [{ x: exit.x + exit.width - 1, y: center(exit).y }, { x: config.width - 1, y: center(exit).y }] },
    ],
    flow: { style: plan.style, entryRoomId: entry.id, objectiveRoomId: objective.id, exitRoomId: exit.id, routeRoomIds: mainRooms.map(room => room.id) },
  }
  if (forest) populateForest(rng, config, layout)
  else {
    const critical = new Set(layout.flow.routeRoomIds)
    for (const room of rooms) {
      if (critical.has(room.id)) continue
      const degree = corridors.filter(corridor => corridor.fromRoomId === room.id || corridor.toRoomId === room.id).length
      if (degree === 1) room.isSecret = rng() < config.layout.secretRoomChance
    }
  }
  return layout
}

const populateForest = (rng: Rng, config: DungeonGeneratorConfig, layout: Layout) => {
  if (config.tacticalTerrain?.cover === 'NONE') return
  // Reserve clearings plus a three-cell path before placing cover. Trees and
  // boulders can shape the encounter without sealing its travel routes.
  const occupied = new Uint8Array(config.width * config.height)
  const occupy = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < config.width && y < config.height) occupied[y * config.width + x] = 1
  }
  for (const room of layout.rooms) {
    for (let x = room.x - 1; x <= room.x + room.width; x += 1) {
      for (let y = room.y - 1; y <= room.y + room.height; y += 1) occupy(x, y)
    }
  }
  for (const corridor of [...layout.corridors, ...layout.portals]) {
    for (const point of cellsOnPath(corridor.points)) {
      for (let x = point.x - 1; x <= point.x + 1; x += 1) {
        for (let y = point.y - 1; y <= point.y + 1; y += 1) occupy(x, y)
      }
    }
  }
  const coverMultiplier = config.tacticalTerrain?.cover === 'HEAVY' ? 1.5 : 1
  const featureTarget = Math.min(1400, Math.floor(config.width * config.height * (0.02 + config.layout.roomDensity * 0.07) * coverMultiplier))
  let cluster = { x: 0, y: 0 }
  for (let attempt = 0; attempt < featureTarget * 25 && layout.terrain.length < featureTarget; attempt += 1) {
    if (attempt % 12 === 0) cluster = { x: integer(rng, 2, config.width - 3), y: integer(rng, 2, config.height - 3) }
    const roll = rng()
    const kind = roll < 0.68 ? 'TREE' : roll < 0.84 ? 'ROCK' : 'BRUSH'
    const width = kind === 'TREE' ? integer(rng, 2, 3) : integer(rng, 1, 2)
    const height = kind === 'TREE' ? width : integer(rng, 1, 2)
    const angle = rng() * Math.PI * 2
    const radius = Math.sqrt(rng()) * 6
    const x = Math.round(cluster.x + Math.cos(angle) * radius)
    const y = Math.round(cluster.y + Math.sin(angle) * radius)
    if (x < 1 || y < 1 || x + width >= config.width || y + height >= config.height) continue
    let clear = true
    for (let dx = x; dx < x + width && clear; dx += 1) {
      for (let dy = y; dy < y + height; dy += 1) if (occupied[dy * config.width + dx]) clear = false
    }
    if (!clear) continue
    layout.terrain.push({ id: `terrain-${layout.terrain.length + 1}`, kind, x, y, width, height, floor: 0 })
    for (let dx = x - 1; dx <= x + width; dx += 1) {
      for (let dy = y - 1; dy <= y + height; dy += 1) occupy(dx, dy)
    }
  }
}

export const generateEncounterLayout = (rng: Rng, config: DungeonGeneratorConfig) => {
  let layout: Layout
  if (config.mapType === 'BUILDING') {
    layout = generateBuildingLayout(rng, config)
  } else {
    const requestedSide = config.accessPoints?.entranceSide ?? 'AUTO'
    const side = requestedSide === 'AUTO' ? config.height > config.width ? 'NORTH' : 'WEST' : requestedSide
    const transpose = side === 'NORTH' || side === 'SOUTH'
    layout = placeEncounter(rng, transpose ? { ...config, width: config.height, height: config.width } : config)
    const transformPoint = ({ x, y }: Point): Point => side === 'EAST' ? { x: config.width - 1 - x, y }
      : side === 'SOUTH' ? { x: y, y: config.height - 1 - x } : side === 'NORTH' ? { x: y, y: x } : { x, y }
    const transformBounds = (bounds: { x: number; y: number; width: number; height: number }) => {
      const { x, y, width, height } = bounds
      return side === 'EAST' ? { x: config.width - x - width, y, width, height }
        : side === 'SOUTH' ? { x: y, y: config.height - x - width, width: height, height: width }
          : side === 'NORTH' ? { x: y, y: x, width: height, height: width } : { x, y, width, height }
    }
    for (const room of layout.rooms) Object.assign(room, transformBounds(room))
    for (const path of [...layout.corridors, ...layout.portals]) path.points = path.points.map(transformPoint)
    for (const feature of layout.terrain) Object.assign(feature, transformBounds(feature))
  }
  populateEncounterFeatures(rng, config, layout)
  return { ...layout, changedCounts: { rooms: layout.rooms.length, corridors: layout.corridors.length } }
}
