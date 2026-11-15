import type { EncounterMapGeneratorConfig, EncounterMapData, EncounterMapRoomGeometry } from '../../../shared/types/encounter-map'
import { buildingPrograms, type RoomSpec } from './building-programs'

type Point = { x: number; y: number }
type Bounds = Point & { width: number; height: number }
type RoomKind = 'ROOM' | 'HALL' | 'STAIRWELL' | 'BALCONY'
type BuildingLayout = Pick<EncounterMapData, 'rooms' | 'corridors'> & {
  terrain: NonNullable<EncounterMapData['terrain']>
  stairs: NonNullable<EncounterMapData['stairs']>
  portals: NonNullable<EncounterMapData['portals']>
  flow: NonNullable<EncounterMapData['flow']>
  floorLabels: string[]
}
/** A floor-plan rectangle: fixed spaces repeat on every floor, the rest receive rooms from the brief. */
type Space = {
  bounds: Bounds
  label: string
  kind: RoomKind
  spec?: RoomSpec
  fixed?: boolean
  /** Fixed circulation joins as soon as it is reachable. */
  early?: boolean
  depth: number
  room?: EncounterMapRoomGeometry
}
type Link = { a: Space; b: Space; points: [Point, Point]; length: number; bridge?: boolean }

// Every generated room is at least three cells across; hole edges keep that spacing
// so the leftover floor area never produces slivers.
const MIN_SIDE = 3
const STAIR = { width: 4, height: 6 }

const integer = (rng: () => number, min: number, max: number) => min + Math.floor(rng() * (max - min + 1))
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const right = (bounds: Bounds) => bounds.x + bounds.width
const bottom = (bounds: Bounds) => bounds.y + bounds.height
const area = (bounds: Bounds) => bounds.width * bounds.height
const intersects = (a: Bounds, b: Bounds) => a.x < right(b) && b.x < right(a) && a.y < bottom(b) && b.y < bottom(a)
/** Two rectangles share a stretch of wall. */
const touches = (a: Bounds, b: Bounds) =>
  (right(a) === b.x || right(b) === a.x) && Math.max(a.y, b.y) < Math.min(bottom(a), bottom(b))
  || (bottom(a) === b.y || bottom(b) === a.y) && Math.max(a.x, b.x) < Math.min(right(a), right(b))

/** Holes must sit inside the frame with edges 0 or ≥ MIN_SIDE from every other edge. */
const fits = (frame: Bounds, holes: Bounds[], hole: Bounds) => {
  if (hole.x < frame.x || hole.y < frame.y || right(hole) > right(frame) || bottom(hole) > bottom(frame)) return false
  if (holes.some(other => intersects(other, hole))) return false
  const all = [frame, ...holes]
  const spaced = (edges: number[], value: number) => edges.every(edge => edge === value || Math.abs(edge - value) >= MIN_SIDE)
  const xs = all.flatMap(item => [item.x, right(item)])
  const ys = all.flatMap(item => [item.y, bottom(item)])
  return [hole.x, right(hole)].every(x => spaced(xs, x)) && [hole.y, bottom(hole)].every(y => spaced(ys, y))
}

const place = (rng: () => number, frame: Bounds, holes: Bounds[], sizes: Array<{ width: number; height: number }>, score: (bounds: Bounds) => number) => {
  const options: Array<{ bounds: Bounds; score: number }> = []
  for (const size of sizes) {
    for (let y = frame.y; y + size.height <= bottom(frame); y += 1) {
      for (let x = frame.x; x + size.width <= right(frame); x += 1) {
        const bounds = { x, y, ...size }
        const value = fits(frame, holes, bounds) ? score(bounds) : -Infinity
        if (value > -Infinity) options.push({ bounds, score: value + rng() * 0.5 })
      }
    }
  }
  return options.sort((a, b) => b.score - a.score)[0]?.bounds
}

/** Split the floor around its holes into maximal bands, merged along the other axis. */
const decompose = (frame: Bounds, holes: Bounds[], transpose: boolean) => {
  const flip = (bounds: Bounds): Bounds => transpose ? { x: bounds.y, y: bounds.x, width: bounds.height, height: bounds.width } : { ...bounds }
  const area = flip(frame)
  const blocks = holes.map(flip)
  const edges = (start: (item: Bounds) => number, end: (item: Bounds) => number) =>
    [...new Set([area, ...blocks].flatMap(item => [start(item), end(item)]))].sort((a, b) => a - b)
  const xs = edges(item => item.x, right)
  const ys = edges(item => item.y, bottom)
  const regions: Bounds[] = []
  let open: Bounds[] = []
  for (let row = 0; row < ys.length - 1; row += 1) {
    const [y0, y1] = [ys[row]!, ys[row + 1]!]
    const runs: Array<[number, number]> = []
    for (let column = 0; column < xs.length - 1; column += 1) {
      const [x0, x1] = [xs[column]!, xs[column + 1]!]
      if (blocks.some(block => block.x <= x0 && right(block) >= x1 && block.y <= y0 && bottom(block) >= y1)) continue
      const last = runs.at(-1)
      if (last?.[1] === x0) last[1] = x1
      else runs.push([x0, x1])
    }
    open = runs.map(([x0, x1]) => {
      const continued = open.find(region => region.x === x0 && right(region) === x1)
      if (continued) {
        continued.height += y1 - y0
        return continued
      }
      const region = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
      regions.push(region)
      return region
    })
  }
  return regions.map(flip)
}

type Leaf = { bounds: Bounds; spec: RoomSpec }
const STOREROOM: RoomSpec = { label: 'Storeroom', area: 9, zone: 'SERVICE', tier: 2, terminal: true }

/**
 * Squarified split of a brief by target area, keeping every leaf at least MIN_SIDE across.
 * Earlier rooms of the brief fall on the side nearer the anchor (the entrance or the stairs).
 */
const treemap = (rng: () => number, bounds: Bounds, specs: RoomSpec[], anchor: Point, keep: (specs: RoomSpec[]) => RoomSpec): Leaf[] => {
  if (specs.length === 1) return [{ bounds, spec: specs[0]! }]
  const total = specs.reduce((sum, spec) => sum + spec.area, 0)
  const need = (count: number, cross: number) => MIN_SIDE * Math.ceil(count / Math.max(1, Math.floor(cross / MIN_SIDE)))
  const axes = bounds.width >= bounds.height ? ['x', 'y'] as const : ['y', 'x'] as const
  for (const axis of axes) {
    const length = axis === 'x' ? bounds.width : bounds.height
    const cross = axis === 'x' ? bounds.height : bounds.width
    let best: { index: number; cut: number; cost: number } | undefined
    let before = 0
    for (let index = 1; index < specs.length; index += 1) {
      before += specs[index - 1]!.area
      const share = before / total
      const low = need(index, cross)
      const high = length - need(specs.length - index, cross)
      if (low > high) continue
      const cut = clamp(Math.round(length * share), low, high)
      const cost = Math.abs(cut / length - share) + Math.abs(share - 0.5) * 0.4 + rng() * 0.15
      if (!best || cost < best.cost) best = { index, cut, cost }
    }
    if (!best) continue
    // The near part takes the first rooms of the brief.
    const nearStart = axis === 'x' ? anchor.x < bounds.x + bounds.width / 2 : anchor.y < bounds.y + bounds.height / 2
    const cut = nearStart ? best.cut : length - best.cut
    const [low, high]: Bounds[] = axis === 'x'
      ? [{ ...bounds, width: cut }, { ...bounds, x: bounds.x + cut, width: bounds.width - cut }]
      : [{ ...bounds, height: cut }, { ...bounds, y: bounds.y + cut, height: bounds.height - cut }]
    const [near, far] = nearStart ? [low!, high!] : [high!, low!]
    return [...treemap(rng, near, specs.slice(0, best.index), anchor, keep), ...treemap(rng, far, specs.slice(best.index), anchor, keep)]
  }
  return [{ bounds, spec: keep(specs) }]
}

/** Deal the brief, in order, across the floor regions from the anchor outward, then subdivide each region. */
const planFloor = (rng: () => number, regions: Bounds[], brief: RoomSpec[], anchor: Point, firstRegion: (region: Bounds) => boolean) => {
  const distance = (region: Bounds) => Math.abs(region.x + region.width / 2 - anchor.x) + Math.abs(region.y + region.height / 2 - anchor.y)
  const ordered = [...regions].sort((a, b) => Number(firstRegion(b)) - Number(firstRegion(a)) || distance(a) - distance(b))
  const specs = [...brief, ...Array.from({ length: Math.max(0, ordered.length - brief.length) }, () => STOREROOM)]
  const rank = (spec: RoomSpec) => spec === brief[0] ? 5 : spec.objective ? 4 : spec.exit ? 3 : spec.hub ? 2 : 1 - spec.tier / 3
  const keep = (group: RoomSpec[]) => [...group].sort((a, b) => rank(b) - rank(a))[0]!
  const totalRegion = ordered.reduce((sum, region) => sum + area(region), 0)
  const totalBrief = specs.reduce((sum, spec) => sum + spec.area, 0)
  let cursor = 0
  let regionArea = 0
  let briefArea = 0
  return ordered.flatMap((region, index) => {
    regionArea += area(region)
    const target = regionArea / totalRegion * totalBrief
    const capacity = Math.floor(region.width / MIN_SIDE) * Math.floor(region.height / MIN_SIDE)
    const reserve = ordered.length - index - 1
    let count = 0
    while (cursor + count < specs.length - reserve && (index === ordered.length - 1
      || count === 0 || count < capacity && briefArea + specs[cursor + count]!.area / 2 <= target)) {
      briefArea += specs[cursor + count]!.area
      count += 1
    }
    const group = specs.slice(cursor, cursor + count)
    cursor += count
    return treemap(rng, region, group, anchor, keep)
  })
}

/** Rooms sharing a wall, plus pairs facing each other across an open well. */
const findLinks = (rng: () => number, spaces: Space[], wells: Bounds[]) => {
  const links: Link[] = []
  const door = (low: number, high: number) => {
    const inset = high - low >= 4 ? Math.floor((high - low) / 4) : 0
    return integer(rng, low + inset, high - 1 - inset)
  }
  for (const [index, a] of spaces.entries()) {
    for (const b of spaces.slice(index + 1)) {
      const [p, q] = [a.bounds, b.bounds]
      const rows = [Math.max(p.y, q.y), Math.min(bottom(p), bottom(q))] as const
      const columns = [Math.max(p.x, q.x), Math.min(right(p), right(q))] as const
      if ((right(p) === q.x || right(q) === p.x) && rows[1] > rows[0]) {
        const y = door(...rows)
        const [left, rightSide] = right(p) === q.x ? [p, q] : [q, p]
        const points: [Point, Point] = [{ x: right(left) - 1, y }, { x: rightSide.x, y }]
        links.push({ a, b, points: left === p ? points : [points[1], points[0]], length: rows[1] - rows[0] })
      } else if ((bottom(p) === q.y || bottom(q) === p.y) && columns[1] > columns[0]) {
        const x = door(...columns)
        const [top, lower] = bottom(p) === q.y ? [p, q] : [q, p]
        const points: [Point, Point] = [{ x, y: bottom(top) - 1 }, { x, y: lower.y }]
        links.push({ a, b, points: top === p ? points : [points[1], points[0]], length: columns[1] - columns[0] })
      }
      for (const well of wells) {
        const acrossX = right(p) === well.x && q.x === right(well) || right(q) === well.x && p.x === right(well)
        const acrossY = bottom(p) === well.y && q.y === bottom(well) || bottom(q) === well.y && p.y === bottom(well)
        const span = acrossX
          ? [Math.max(p.y, q.y, well.y), Math.min(bottom(p), bottom(q), bottom(well))] as const
          : [Math.max(p.x, q.x, well.x), Math.min(right(p), right(q), right(well))] as const
        if (!(acrossX || acrossY) || span[1] <= span[0]) continue
        const offset = door(...span)
        const [near, far] = acrossX ? (p.x < q.x ? [p, q] : [q, p]) : (p.y < q.y ? [p, q] : [q, p])
        const points: [Point, Point] = acrossX
          ? [{ x: right(near) - 1, y: offset }, { x: far.x, y: offset }]
          : [{ x: offset, y: bottom(near) - 1 }, { x: offset, y: far.y }]
        links.push({ a, b, points: near === p ? points : [points[1], points[0]], length: span[1] - span[0], bridge: true })
      }
    }
  }
  return links
}

/** Grow doors from the entry: each room opens onto the most fitting neighbor already reached. */
const connectRooms = (spaces: Space[], links: Link[], root: Space) => {
  const neighbors = new Map(spaces.map(space => [space, [] as Array<{ space: Space; link: Link }>]))
  for (const link of links.filter(item => !item.bridge)) {
    neighbors.get(link.a)!.push({ space: link.b, link })
    neighbors.get(link.b)!.push({ space: link.a, link })
  }
  const position = new Map(spaces.map((space, index) => [space, index]))
  const circulation = (space: Space) => space.kind === 'HALL' || space.kind === 'STAIRWELL' || Boolean(space.spec?.hub)
  // Stairs open from halls and main rooms; other rooms prefer their named neighbors,
  // and back-of-house rooms avoid opening straight onto public ones.
  const score = (child: Space, parent: Space, link: Link) => {
    const named = Boolean(child.spec?.via?.includes(parent.label))
    const backstage = child.spec && child.spec.zone !== 'PUBLIC' && parent.spec?.zone === 'PUBLIC' && !named
    return (named ? 4 : 0)
      + (circulation(parent) ? child.fixed ? 4 : 1.5 : 0)
      + (parent.spec && parent.spec.zone === child.spec?.zone ? 1 : 0)
      - (backstage ? 2 : 0)
      - (parent.spec?.terminal ? 6 : 0) - (link.length < 2 ? 1 : 0)
      - (child.early ? 0 : position.get(child)! * 0.35)
      + (child.early ? 20 : 0)
  }
  const joined = new Set([root])
  const order = [root]
  const doors: Link[] = []
  root.depth = 0
  for (;;) {
    const choice = order.flatMap(parent => neighbors.get(parent)!.filter(item => !joined.has(item.space))
      .map(item => ({ space: item.space, parent, link: item.link, score: score(item.space, parent, item.link) })))
      .sort((a, b) => b.score - a.score)[0]
    if (!choice) break
    joined.add(choice.space)
    order.push(choice.space)
    choice.space.depth = choice.parent.depth + 1
    doors.push(choice.link)
  }
  return { doors, order }
}

/** Plan the building's brief first; circulation follows the rooms' relationships rather than a fixed hall. */
export const generateBuildingLayout = (rng: () => number, config: EncounterMapGeneratorConfig): BuildingLayout => {
  const program = buildingPrograms[config.buildingType]
  const style = config.encounterFlow
  const tier = config.encounterScale === 'SINGLE' ? 0 : config.encounterScale === 'SEQUENCE' ? 1 : 2
  const floors = config.floorCount
  const vertical = config.verticalConnections
  const groundFloor = vertical.basement ? 1 : 0
  const objectiveFloor = vertical.basement && floors === 2 ? 0 : floors - 1
  const requestedSide = config.accessPoints.entranceSide
  const entranceSide = requestedSide === 'AUTO' ? config.width > config.height ? 'EAST' : 'SOUTH' : requestedSide
  const rotated = entranceSide === 'EAST' || entranceSide === 'WEST'
  const reversed = entranceSide === 'NORTH' || entranceSide === 'WEST'
  const canvasWidth = rotated ? config.height : config.width
  const canvasHeight = rotated ? config.width : config.height
  const mirrored = rng() < 0.5

  // Each floor's brief, trimmed to the encounter scale. A single-storey building
  // keeps its private rooms on the ground floor.
  const pick = (specs: RoomSpec[]) => specs.filter(spec => spec.tier <= tier)
  const briefs = Array.from({ length: floors }, (_, floor) => {
    const ground = floor === groundFloor
    const specs = ground
      ? [...pick(program.ground), ...(floors === 1 ? pick(program.upper).filter(spec => !spec.hall && !spec.hub) : [])]
      : pick(floor < groundFloor ? program.basement : program.upper)
    if (floor === objectiveFloor) specs.push(program.objective[ground ? 'ground' : floor < groundFloor ? 'basement' : 'upper'])
    return specs
  })

  const stairCount = floors > 1 ? vertical.staircases === 'DUAL' ? 2 : 1 : 0
  const ladders = floors > 1 && vertical.ladders
  const fixedArea = stairCount * area({ x: 0, y: 0, ...STAIR }) + (ladders ? 12 : 0)
  const totalArea = Math.max(...briefs.map(specs => specs.reduce((sum, spec) => sum + spec.area, 0))) + fixedArea
  const minimumSide = floors > 1 ? 14 : 10
  const aspect = 0.8 + rng() * 0.7
  const footprintWidth = clamp(Math.round(Math.sqrt(totalArea * aspect)), Math.min(minimumSide, canvasWidth - 4), canvasWidth - 4)
  const footprintHeight = clamp(Math.ceil(totalArea / footprintWidth), Math.min(minimumSide, canvasHeight - 4), canvasHeight - 4)
  const frame = {
    x: Math.floor((canvasWidth - footprintWidth) / 2),
    y: Math.floor((canvasHeight - footprintHeight) / 2),
    width: footprintWidth,
    height: footprintHeight,
  }

  // Stairs, ladder closets and their landings stack at the same place on every floor.
  const cores: Array<Pick<Space, 'bounds' | 'label' | 'kind' | 'spec'>> = []
  const holes = () => cores.map(core => core.bounds)
  const stairDepth = frame.y + frame.height * (0.3 + rng() * 0.35)
  for (let index = 0; index < stairCount; index += 1) {
    const wall = index === 0 ? frame.x : right(frame) - STAIR.width
    const target = index === 0 ? stairDepth : frame.y + frame.height * (0.2 + rng() * 0.6)
    const bounds = place(rng, frame, holes(), [STAIR], candidate =>
      -Math.abs(candidate.y + STAIR.height / 2 - target) / 2 - Math.abs(candidate.x - wall) / 3)
    if (!bounds) throw new Error('The building footprint has no room for its staircases.')
    cores.push({ bounds, label: index === 0 ? 'Stairwell' : 'Service stairwell', kind: 'STAIRWELL' })
  }
  if (ladders) {
    const bounds = place(rng, frame, holes(), [{ width: 3, height: 3 }, { width: 4, height: 3 }, { width: 3, height: 4 }, { width: 4, height: 4 }],
      candidate => -(candidate.y - frame.y) - Math.min(candidate.x - frame.x, right(frame) - right(candidate)) - area(candidate) / 4)
    if (!bounds) throw new Error('The building footprint has no room for its ladder closet.')
    cores.push({ bounds, label: 'Utility closet', kind: 'ROOM', spec: { label: 'Utility closet', area: 12, zone: 'SERVICE', tier: 0, terminal: true } })
  }
  const mainStair = cores.find(core => core.kind === 'STAIRWELL')?.bounds
  const transpose = rng() < 0.5

  const transformPoint = (point: Point): Point => {
    const x = mirrored ? canvasWidth - point.x - 1 : point.x
    const y = reversed ? canvasHeight - point.y - 1 : point.y
    return rotated ? { x: y, y: x } : { x, y }
  }
  const transformBounds = (bounds: Bounds): Bounds => {
    const x = mirrored ? canvasWidth - bounds.x - bounds.width : bounds.x
    const y = reversed ? canvasHeight - bounds.y - bounds.height : bounds.y
    return rotated
      ? { x: y, y: x, width: bounds.height, height: bounds.width }
      : { ...bounds, x, y }
  }
  const rooms: EncounterMapData['rooms'] = []
  const corridors: EncounterMapData['corridors'] = []
  const stairs: NonNullable<EncounterMapData['stairs']> = []
  const canonicalBounds = new Map<string, Bounds>()
  const addRoom = (space: Space, floor: number) => {
    const room: EncounterMapRoomGeometry = {
      id: `room-${rooms.length + 1}`, roomNumber: rooms.length + 1,
      ...transformBounds(space.bounds), label: space.label, kind: space.kind, floor, isSecret: false,
    }
    rooms.push(room)
    canonicalBounds.set(room.id, space.bounds)
    space.room = room
    return room
  }
  const addCorridor = (link: Pick<Link, 'a' | 'b' | 'points'>) => {
    corridors.push({ id: `corridor-${corridors.length + 1}`, fromRoomId: link.a.room!.id, toRoomId: link.b.room!.id, points: link.points.map(transformPoint) })
  }

  const coreRooms: EncounterMapRoomGeometry[][] = cores.map(() => [])
  let entry: EncounterMapRoomGeometry | undefined
  let objective: EncounterMapRoomGeometry | undefined
  let exit: EncounterMapRoomGeometry | undefined
  for (let floor = 0; floor < floors; floor += 1) {
    const ground = floor === groundFloor
    const fixed: Space[] = cores.map(core => ({ ...core, bounds: { ...core.bounds }, fixed: true, depth: 0 }))
    let roles = briefs[floor]!

    // Upper floors of inns and laboratories line their rooms along a corridor from the stairs.
    if (program.corridor && floor > groundFloor && roles.length >= 5 && mainStair) {
      const stair = mainStair
      // Run across the building beside, in front of, or behind the stairwell, stopping at other cores.
      const options = [stair.y, bottom(stair) - MIN_SIDE, stair.y - MIN_SIDE, bottom(stair)].flatMap((y) => {
        const blockers = holes().filter(hole => hole.y < y + MIN_SIDE && bottom(hole) > y).sort((a, b) => a.x - b.x)
        const runs: Bounds[] = []
        let x = frame.x
        for (const hole of [...blockers, { x: right(frame), width: 0 }]) {
          if (hole.x > x) runs.push({ x, y, width: hole.x - x, height: MIN_SIDE })
          x = Math.max(x, hole.x + hole.width)
        }
        return runs
      }).filter(bounds => bounds.width >= 6 && touches(bounds, stair) && fits(frame, holes(), bounds))
        .sort((a, b) => b.width - a.width)
      if (options[0]) {
        fixed.push({ bounds: options[0], label: roles[0]!.label, kind: 'HALL', spec: roles[0], fixed: true, early: true, depth: 0 })
        roles = roles.slice(1)
      }
    }
    // Bridges cross an open well: over a double-height ground-floor room, or a light well
    // when there is no upper floor.
    const wells: Bounds[] = []
    if (vertical.bridges && (floor > groundFloor || floors === 1)) {
      const inner = { x: frame.x + MIN_SIDE, y: frame.y + MIN_SIDE, width: frame.width - MIN_SIDE * 2, height: frame.height - MIN_SIDE * 2 }
      const sizes = [6, 5, 4, 3].flatMap(length => [{ width: MIN_SIDE, height: length }, { width: length, height: MIN_SIDE }])
      const middle = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }
      // Keep the well inside the walls so rooms surround it on every side.
      const bounds = place(rng, frame, fixed.map(space => space.bounds), sizes, candidate =>
        candidate.x >= inner.x && candidate.y >= inner.y && right(candidate) <= right(inner) && bottom(candidate) <= bottom(inner)
          ? area(candidate) / 6 - (Math.abs(candidate.x + candidate.width / 2 - middle.x) + Math.abs(candidate.y + candidate.height / 2 - middle.y)) / 4
          : -Infinity)
      if (bounds) wells.push(bounds)
    }

    const regions = decompose(frame, [...fixed.map(space => space.bounds), ...wells], transpose)
    // The ground floor grows from the front door; other floors from the stairs.
    const anchor = ground || !mainStair
      ? { x: frame.x + frame.width / 2, y: bottom(frame) }
      : { x: mainStair.x + mainStair.width / 2, y: mainStair.y + mainStair.height / 2 }
    const leaves = planFloor(rng, regions, roles, anchor, region => ground && bottom(region) === bottom(frame))
    const free: Space[] = leaves.map(({ bounds, spec }) => ({ bounds, spec, label: spec.label, kind: spec.hall ? 'HALL' : 'ROOM', depth: 0 }))
    const spaces = [...fixed, ...free]
    const links = findLinks(rng, spaces, wells)
    const root = ground ? free.find(space => space.spec === roles[0]) ?? free[0]! : fixed.find(space => space.kind === 'STAIRWELL') ?? free[0]!
    const { doors, order } = connectRooms(spaces, links, root)
    for (const space of order) addRoom(space, floor)
    for (const link of doors) addCorridor(link)
    for (const [index, core] of fixed.slice(0, cores.length).entries()) coreRooms[index]!.push(core.room!)

    const pairKey = (link: Link) => [link.a.room!.roomNumber, link.b.room!.roomNumber].sort((a, b) => a - b).join(':')
    const connected = new Set(doors.map(pairKey))
    const passable = (space: Space) => !space.spec?.terminal
    const bridges = links.filter(link => link.bridge).sort((a, b) =>
      Number(passable(b.a) && passable(b.b)) - Number(passable(a.a) && passable(a.b)) || b.length - a.length)
    if (bridges[0]) addCorridor(bridges[0])
    // Alternate routes add a second doorway between circulating rooms far apart in the plan.
    if (style === 'LOOP') {
      const graph = new Map(spaces.map(space => [space, [] as Space[]]))
      for (const link of doors) {
        graph.get(link.a)!.push(link.b)
        graph.get(link.b)!.push(link.a)
      }
      const distance = (from: Space, to: Space) => {
        const seen = new Map([[from, 0]])
        for (const space of seen.keys()) {
          for (const next of graph.get(space)!) if (!seen.has(next)) seen.set(next, seen.get(space)! + 1)
        }
        return seen.get(to) ?? 0
      }
      const shortcuts = links.filter(link => !link.bridge && !connected.has(pairKey(link)) && passable(link.a) && passable(link.b)
        && link.a.kind !== 'STAIRWELL' && link.b.kind !== 'STAIRWELL')
        .map(link => ({ link, distance: distance(link.a, link.b) })).filter(item => item.distance >= 3)
        .sort((a, b) => b.distance - a.distance)
      for (const { link } of shortcuts.slice(0, tier === 2 ? 2 : 1)) addCorridor(link)
    }
    if (vertical.balconies && floor > groundFloor) {
      const front = free.filter(space => bottom(space.bounds) === bottom(frame)).sort((a, b) => b.bounds.width - a.bounds.width)[0]
      const height = Math.min(3, canvasHeight - bottom(frame))
      if (front && height > 0) {
        const width = Math.min(6, front.bounds.width)
        const balcony: Space = {
          bounds: { x: front.bounds.x + Math.floor((front.bounds.width - width) / 2), y: bottom(frame), width, height },
          label: 'Balcony', kind: 'BALCONY', depth: 0,
        }
        addRoom(balcony, floor)
        const x = balcony.bounds.x + Math.floor(width / 2)
        addCorridor({ a: front, b: balcony, points: [{ x, y: bottom(frame) - 1 }, { x, y: bottom(frame) }] })
      }
    }

    if (ground) {
      entry = root.room
      // The back door belongs to a service room on an outside wall, ideally away from the front.
      const rear = (bounds: Bounds) => bounds.y === frame.y || bounds.x === frame.x || right(bounds) === right(frame)
      exit = free.filter(space => space !== root && !space.spec?.objective && (rear(space.bounds) || bottom(space.bounds) === bottom(frame)))
        .sort((a, b) => Number(Boolean(b.spec?.exit)) - Number(Boolean(a.spec?.exit)) || Number(rear(b.bounds)) - Number(rear(a.bounds)) || b.depth - a.depth)[0]?.room
    }
    if (floor === objectiveFloor) objective = free.find(space => space.spec?.objective)?.room
  }

  for (let floor = 1; floor < floors; floor += 1) {
    for (const [index, core] of cores.entries()) {
      const from = coreRooms[index]![floor - 1]!
      const to = coreRooms[index]![floor]!
      if (core.kind === 'STAIRWELL') {
        stairs.push({
          id: index === 0 ? `stairs-${floor}` : `service-stairs-${floor}`, fromRoomId: from.id, toRoomId: to.id,
          kind: 'STAIRS', ...transformBounds({ x: core.bounds.x + 1, y: core.bounds.y + 1, width: 2, height: 4 }),
        })
      } else {
        stairs.push({
          id: `ladder-${floor}`, fromRoomId: from.id, toRoomId: to.id,
          kind: 'LADDER', ...transformBounds({ x: core.bounds.x + 1, y: core.bounds.y + 1, width: 1, height: 1 }),
        })
      }
    }
  }
  if (!entry || !objective || !exit) throw new Error('The building plan has no distinct entrance, objective, and exit.')

  const entryBounds = canonicalBounds.get(entry.id)!
  const entranceX = entryBounds.x + Math.floor(entryBounds.width / 2)
  const exitBounds = canonicalBounds.get(exit.id)!
  const exitMiddle = { x: exitBounds.x + Math.floor(exitBounds.width / 2), y: exitBounds.y + Math.floor(exitBounds.height / 2) }
  const exitPoints = exitBounds.y === frame.y ? [{ x: exitMiddle.x, y: frame.y }, { x: exitMiddle.x, y: 0 }]
    : exitBounds.x === frame.x ? [{ x: frame.x, y: exitMiddle.y }, { x: 0, y: exitMiddle.y }]
      : right(exitBounds) === right(frame) ? [{ x: right(frame) - 1, y: exitMiddle.y }, { x: canvasWidth - 1, y: exitMiddle.y }]
        : [{ x: exitMiddle.x, y: bottom(frame) - 1 }, { x: exitMiddle.x, y: canvasHeight - 1 }]
  const portals: NonNullable<EncounterMapData['portals']> = [
    { id: 'portal-entrance', kind: 'ENTRANCE', roomId: entry.id, points: [{ x: entranceX, y: bottom(frame) - 1 }, { x: entranceX, y: canvasHeight - 1 }].map(transformPoint) },
    { id: 'portal-exit', kind: 'EXIT', roomId: exit.id, points: exitPoints.map(transformPoint) },
  ]

  const adjacent = new Map(rooms.map(room => [room.id, [] as string[]]))
  for (const connection of [...corridors, ...stairs]) {
    adjacent.get(connection.fromRoomId)!.push(connection.toRoomId)
    adjacent.get(connection.toRoomId)!.push(connection.fromRoomId)
  }
  const route = (from: string, to: string) => {
    const previous = new Map<string, string | null>([[from, null]])
    const pending = [from]
    for (const roomId of pending) {
      if (roomId === to) break
      for (const next of adjacent.get(roomId)!) {
        if (previous.has(next)) continue
        previous.set(next, roomId)
        pending.push(next)
      }
    }
    if (!previous.has(to)) throw new Error('Building circulation does not reach its objective or exit.')
    const path: string[] = []
    let roomId: string | null = to
    while (roomId !== null) { path.push(roomId); roomId = previous.get(roomId)! }
    return path.reverse()
  }
  return {
    rooms, corridors, terrain: [], stairs, portals,
    floorLabels: Array.from({ length: floors }, (_, floor) => floor < groundFloor ? 'Basement' : floor === groundFloor ? 'Ground floor' : `Floor ${floor - groundFloor + 1}`),
    flow: {
      style, entryRoomId: entry.id, objectiveRoomId: objective.id, exitRoomId: exit.id,
      routeRoomIds: [...route(entry.id, objective.id), ...route(objective.id, exit.id).slice(1)],
    },
  }
}
