import type { DungeonGeneratorConfig, DungeonMapData, DungeonRoomGeometry } from '../../../shared/types/dungeon'

type Point = { x: number; y: number }
type Bounds = Point & { width: number; height: number }
type RoomKind = 'ROOM' | 'HALL' | 'STAIRWELL' | 'BALCONY'
type BuildingLayout = Pick<DungeonMapData, 'rooms' | 'corridors'> & {
  terrain: NonNullable<DungeonMapData['terrain']>
  stairs: NonNullable<DungeonMapData['stairs']>
  portals: NonNullable<DungeonMapData['portals']>
  flow: NonNullable<DungeonMapData['flow']>
  floorLabels: string[]
}

const integer = (rng: () => number, min: number, max: number) => min + Math.floor(rng() * (max - min + 1))

/** Plan circulation first; occupied rooms open onto it rather than becoming passageways. */
export const generateBuildingLayout = (rng: () => number, config: DungeonGeneratorConfig): BuildingLayout => {
  const style = config.encounterFlow ?? 'BRANCHING'
  const scale = config.encounterScale ?? 'SEQUENCE'
  const floors = config.floorCount ?? 1
  const vertical = config.verticalConnections
  const groundFloor = vertical?.basement ? 1 : 0
  const objectiveFloor = vertical?.basement && floors === 2 ? 0 : floors - 1
  // Use the long map axis for the approach. Oversized canvases leave grounds around
  // a bounded building instead of producing hundreds of repeated household rooms.
  const requestedSide = config.accessPoints?.entranceSide ?? 'AUTO'
  const entranceSide = requestedSide === 'AUTO' ? config.width > config.height ? 'EAST' : 'SOUTH' : requestedSide
  const rotated = entranceSide === 'EAST' || entranceSide === 'WEST'
  const reversed = entranceSide === 'NORTH' || entranceSide === 'WEST'
  const canvasWidth = rotated ? config.height : config.width
  const canvasHeight = rotated ? config.width : config.height
  const mirrored = rng() < 0.5
  const roomSpan = Math.max(6, Math.min(18, config.layout.maxRoomSize))
  const hallWidth = canvasWidth < 32 ? 4 : integer(rng, 4, 5)
  const galleryWidth = style === 'LOOP' ? 3 : 0
  const bridgeGap = vertical?.bridges ? 2 : 0
  const footprintWidth = Math.min(canvasWidth - 4, (scale === 'SINGLE' ? 12 : roomSpan * 2) + hallWidth + galleryWidth + bridgeGap)
  const footprintHeight = Math.min(canvasHeight - 4, scale === 'SINGLE' ? 16 : scale === 'SEQUENCE' ? 30 : 60)
  const footprint = {
    x: Math.floor((canvasWidth - footprintWidth) / 2),
    y: Math.floor((canvasHeight - footprintHeight) / 2),
    width: footprintWidth,
    height: footprintHeight,
  }
  const frontDepth = scale === 'COMPLEX' ? 3 : Math.max(3, Math.min(7, Math.floor(footprint.height * (0.14 + rng() * 0.04))))
  const rearDepth = scale === 'COMPLEX' ? 3 : Math.max(3, Math.min(7, Math.floor(footprint.height * (0.14 + rng() * 0.04))))
  const middleY = footprint.y + rearDepth
  const middleHeight = footprint.height - frontDepth - rearDepth
  const leftWidth = Math.floor((footprint.width - hallWidth - galleryWidth - bridgeGap) / 2)
  const hallX = footprint.x + leftWidth
  const rightX = hallX + hallWidth + bridgeGap
  const rightWidth = footprint.width - leftWidth - hallWidth - galleryWidth - bridgeGap
  let stairDepth = 6
  if (middleHeight - stairDepth < 3) stairDepth = middleHeight
  const stairBounds = { x: footprint.x, y: middleY + middleHeight - stairDepth, width: leftWidth, height: stairDepth }
  // The flight sits against the outside wall when space is tight, retaining a
  // clear landing strip beside its hall doorway plus landings at both ends.
  const stairFootprint = { x: stairBounds.x + Math.min(1, leftWidth - 3), y: stairBounds.y + 1, width: 2, height: 4 }
  const secondStairBounds = { x: rightX, y: middleY, width: rightWidth, height: stairDepth }
  const secondStairFootprint = { x: rightX + rightWidth - 2 - Math.min(1, rightWidth - 3), y: middleY + 1, width: 2, height: 4 }
  const secondaryStairs = floors > 1 && vertical?.staircases === 'DUAL'
  const laddersEnabled = floors > 1 && vertical?.ladders
  const rightFreeHeight = middleHeight - (secondaryStairs ? stairDepth : 0)
  const ladderDepth = laddersEnabled ? rightFreeHeight < 6 ? rightFreeHeight : 3 : 0
  const ladderBounds = { x: rightX, y: middleY + middleHeight - ladderDepth, width: rightWidth, height: ladderDepth }

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
  const rooms: DungeonMapData['rooms'] = []
  const corridors: DungeonMapData['corridors'] = []
  const stairs: NonNullable<DungeonMapData['stairs']> = []
  const canonicalBounds = new Map<string, Bounds>()
  const addRoom = (bounds: Bounds, label: string, kind: RoomKind, floor: number) => {
    const room: DungeonRoomGeometry = {
      id: `room-${rooms.length + 1}`, roomNumber: rooms.length + 1,
      ...transformBounds(bounds), label, kind, floor, isSecret: false,
    }
    rooms.push(room)
    canonicalBounds.set(room.id, bounds)
    return room
  }
  const connect = (from: DungeonRoomGeometry, to: DungeonRoomGeometry) => {
    const a = canonicalBounds.get(from.id)!
    const b = canonicalBounds.get(to.id)!
    let points: Point[]
    if ((a.x + a.width <= b.x || b.x + b.width <= a.x) && Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height)) {
      const y = Math.floor((Math.max(a.y, b.y) + Math.min(a.y + a.height, b.y + b.height) - 1) / 2)
      points = a.x < b.x ? [{ x: a.x + a.width - 1, y }, { x: b.x, y }] : [{ x: a.x, y }, { x: b.x + b.width - 1, y }]
    } else if ((a.y + a.height === b.y || b.y + b.height === a.y) && Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width)) {
      const x = Math.floor((Math.max(a.x, b.x) + Math.min(a.x + a.width, b.x + b.width) - 1) / 2)
      points = a.y < b.y ? [{ x, y: a.y + a.height - 1 }, { x, y: b.y }] : [{ x, y: a.y }, { x, y: b.y + b.height - 1 }]
    } else {
      throw new Error('Building rooms must face one another before a passage can connect them.')
    }
    corridors.push({ id: `corridor-${corridors.length + 1}`, fromRoomId: from.id, toRoomId: to.id, points: points.map(transformPoint) })
  }

  const stairwells: DungeonRoomGeometry[] = []
  const secondStairwells: DungeonRoomGeometry[] = []
  const ladderRooms: DungeonRoomGeometry[] = []
  let entry: DungeonRoomGeometry | undefined
  let objective: DungeonRoomGeometry | undefined
  let exit: DungeonRoomGeometry | undefined
  const objectiveLabels = ['Audience chamber', 'Council chamber', 'Strongroom']
  const upperObjectiveLabels = ['Private study', 'Master suite', 'Restricted archive']
  const objectiveLabel = objectiveFloor < groundFloor ? 'Sealed cellar' : (floors === 1 ? objectiveLabels : upperObjectiveLabels)[integer(rng, 0, 2)]!

  for (let floor = 0; floor < floors; floor += 1) {
    const ground = floor === groundFloor
    const basement = floor < groundFloor
    const front = addRoom({ ...footprint, y: footprint.y + footprint.height - frontDepth, height: frontDepth }, ground ? 'Reception' : basement ? 'Cellar antechamber' : 'Sitting room', 'ROOM', floor)
    const hall = addRoom({ x: hallX, y: middleY, width: hallWidth, height: middleHeight }, ground ? 'Public hall' : basement ? 'Cellar passage' : 'Upper hall', 'HALL', floor)
    const rear = addRoom({
      ...footprint,
      ...(floors === 1 ? { x: hallX, width: footprint.width - leftWidth } : {}),
      height: rearDepth,
    }, floor === objectiveFloor ? objectiveLabel : ground ? 'Service foyer' : basement ? 'Cold store' : 'Upper gallery', 'ROOM', floor)
    connect(front, hall)
    connect(hall, rear)
    if (ground) { entry = front; exit = rear }
    if (floor === objectiveFloor) objective = rear
    if (floors === 1) {
      exit = addRoom({ ...footprint, width: leftWidth, height: rearDepth }, 'Service foyer', 'ROOM', floor)
      connect(rear, exit)
    }

    if (style === 'LOOP') {
      const gallery = addRoom({ x: footprint.x + footprint.width - galleryWidth, y: middleY, width: galleryWidth, height: middleHeight }, 'Service gallery', 'HALL', floor)
      connect(front, gallery)
      connect(gallery, rear)
    }
    if (floors > 1) {
      const stairwell = addRoom(stairBounds, 'Stairwell', 'STAIRWELL', floor)
      connect(hall, stairwell)
      stairwells.push(stairwell)
    }
    if (secondaryStairs) {
      const stairwell = addRoom(secondStairBounds, 'Service stairwell', 'STAIRWELL', floor)
      connect(hall, stairwell)
      secondStairwells.push(stairwell)
    }
    if (laddersEnabled) {
      const closet = addRoom(ladderBounds, 'Utility closet', 'ROOM', floor)
      connect(hall, closet)
      ladderRooms.push(closet)
    }
    if (vertical?.balconies && floor > groundFloor) {
      const balconyWidth = Math.min(8, footprint.width)
      const balcony = addRoom({
        x: footprint.x + Math.floor((footprint.width - balconyWidth) / 2),
        y: footprint.y + footprint.height,
        width: balconyWidth,
        height: Math.min(3, canvasHeight - footprint.y - footprint.height),
      }, 'Balcony', 'BALCONY', floor)
      connect(front, balcony)
    }

    const addWingRooms = (bounds: Bounds, labels: string[]) => {
      if (bounds.height < 3 || bounds.width < 3) return
      const desiredCount = scale === 'SINGLE' ? 1 : scale === 'SEQUENCE' ? 3 : 8
      const count = Math.max(1, Math.min(labels.length, desiredCount, Math.floor(bounds.height / 3)))
      let y = bounds.y
      for (let index = 0; index < count; index += 1) {
        const remaining = bounds.y + bounds.height - y
        const height = index === count - 1 ? remaining : Math.floor(remaining / (count - index))
        const room = addRoom({ ...bounds, y, height }, labels[index]!, 'ROOM', floor)
        connect(hall, room)
        y += height
      }
    }
    // Service rooms cluster toward the rear exit; sleeping/private rooms remain
    // leaves upstairs. A loop uses its own gallery, never somebody's bedroom.
    addWingRooms({ x: footprint.x, y: middleY, width: leftWidth, height: middleHeight - (floors > 1 ? stairDepth : 0) }, ground
      ? ['Kitchen', 'Dining room', 'Pantry', 'Workshop', 'Scullery', 'Staff room', 'Laundry', 'Equipment store']
      : basement ? ['Wine cellar', 'Root cellar', 'Fuel store', 'Boiler room', 'Workshop', 'Cistern room', 'Dry store', 'Old vault']
        : ['Library', 'Linen room', 'Guest room', 'Washroom', 'Reading room', 'Dressing room', 'Servant room', 'Music room'])
    addWingRooms({ x: rightX, y: middleY + (secondaryStairs ? stairDepth : 0), width: rightWidth, height: rightFreeHeight - ladderDepth }, ground
      ? ['Archive', 'Meeting room', 'Public office', 'Guard room', 'Waiting room', 'Records office', 'Cloakroom', 'Reception office']
      : basement ? ['Holding room', 'Supply store', 'Pump room', 'Maintenance room', 'Coal bunker', 'Storage vault', 'Chamber of relics', 'Tasting room']
        : ['Bedroom', 'Guest bedroom', 'Private office', 'Storage', 'Bathroom', 'Nursery', 'Gallery', 'Sewing room'])
  }

  for (let floor = 1; floor < stairwells.length; floor += 1) {
    stairs.push({
      id: `stairs-${floor}`, fromRoomId: stairwells[floor - 1]!.id, toRoomId: stairwells[floor]!.id,
      kind: 'STAIRS', ...transformBounds(stairFootprint),
    })
    if (secondaryStairs) {
      stairs.push({
        id: `service-stairs-${floor}`, fromRoomId: secondStairwells[floor - 1]!.id, toRoomId: secondStairwells[floor]!.id,
        kind: 'STAIRS', ...transformBounds(secondStairFootprint),
      })
    }
    if (laddersEnabled) {
      stairs.push({
        id: `ladder-${floor}`, fromRoomId: ladderRooms[floor - 1]!.id, toRoomId: ladderRooms[floor]!.id,
        kind: 'LADDER', ...transformBounds({ x: ladderBounds.x + 1, y: ladderBounds.y + 1, width: 1, height: 1 }),
      })
    }
  }
  const entranceX = hallX + Math.floor(hallWidth / 2)
  const exitBounds = canonicalBounds.get(exit!.id)!
  const exitX = exitBounds.x + Math.floor(exitBounds.width / 2)
  const portals: NonNullable<DungeonMapData['portals']> = [
    { id: 'portal-entrance', kind: 'ENTRANCE', roomId: entry!.id, points: [{ x: entranceX, y: footprint.y + footprint.height - 1 }, { x: entranceX, y: canvasHeight - 1 }].map(transformPoint) },
    { id: 'portal-exit', kind: 'EXIT', roomId: exit!.id, points: [{ x: exitX, y: footprint.y }, { x: exitX, y: 0 }].map(transformPoint) },
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
      style, entryRoomId: entry!.id, objectiveRoomId: objective!.id, exitRoomId: exit!.id,
      routeRoomIds: [...route(entry!.id, objective!.id), ...route(objective!.id, exit!.id).slice(1)],
    },
  }
}
