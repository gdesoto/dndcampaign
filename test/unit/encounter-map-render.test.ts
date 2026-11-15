import { expect, it } from 'vitest'
import sharp from 'sharp'
import { encounterMapSchema } from '../../shared/schemas/encounter-map'
import type { EncounterMapData } from '../../shared/types/encounter-map'
import { getEncounterMapFloorMap, toPlayerSafeMap } from '../../shared/utils/encounter-map'
import { renderEncounterMapLegend, renderEncounterMapSvg } from '../../shared/utils/encounter-map-render'

const exampleMap = (): EncounterMapData => ({
  schemaVersion: 1, gridType: 'SQUARE', width: 20, height: 12, cellSize: 32,
  rooms: [
    { id: 'entry', roomNumber: 1, x: 2, y: 2, width: 4, height: 4, isSecret: false },
    { id: 'hall', roomNumber: 2, x: 10, y: 2, width: 4, height: 4, isSecret: false },
  ],
  corridors: [{ id: 'passage', fromRoomId: 'entry', toRoomId: 'hall', points: [{ x: 4, y: 4 }, { x: 12, y: 4 }] }],
  doors: [], walls: [], zones: [], traps: [], encounters: [], treasures: [], dressing: [],
  metadata: { algorithmVersion: '1.0.0', configHash: 'hash', seed: 'seed', generatedAt: '2026-10-01T00:00:00.000Z', passHistory: [] },
})

it('draws continuous passage floors through legacy room walls and safely renders imported labels', async () => {
  const map = exampleMap()
  map.rooms[0]!.label = '<script>alert("import")</script>'
  map.rooms[0]!.id = 'entry" onload="alert(1)'
  map.corridors[0]!.fromRoomId = map.rooms[0]!.id
  const svg = renderEncounterMapSvg(map, { includeGrid: false, includeLabels: false })
  const { data, info } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const color = (x: number, y: number) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)]
  // Both doorway boundaries and the corridor have the same unobstructed floor surface.
  expect(color(6 * 32, 4.5 * 32)).toEqual(color(8 * 32, 4.5 * 32))
  expect(color(10 * 32, 4.5 * 32)).toEqual(color(8 * 32, 4.5 * 32))
  expect(color(6 * 32, 3 * 32)).not.toEqual(color(8 * 32, 4.5 * 32))
  expect(svg).not.toContain('<script>')
  expect(svg).not.toContain('data-layer="labels"')
  expect(svg).not.toContain('data-layer="grid"')
  expect(svg).toContain('entry&quot; onload=&quot;alert(1)')
  expect(renderEncounterMapSvg(map)).toContain('&lt;script&gt;alert(&quot;import&quot;)&lt;/script&gt;')
})

it('opens only modeled boundary portals, with optional route guidance hidden from player-safe maps', async () => {
  const map = exampleMap()
  map.rooms[0]!.label = 'Entrance'
  const renderedPixel = async (svg: string, x: number, y: number) => {
    const { data, info } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    return [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)]
  }
  const options = { includeGrid: false, includeLabels: false }
  const legacySvg = renderEncounterMapSvg(map, options)
  expect(await renderedPixel(legacySvg, 4.5 * 32, 6 * 32)).not.toEqual([198, 183, 151])
  map.portals = [
    { id: 'entrance', kind: 'ENTRANCE', roomId: 'entry', points: [{ x: 4, y: 5 }, { x: 4, y: 11 }] },
    { id: 'exit', kind: 'EXIT', roomId: 'hall', points: [{ x: 13, y: 3 }, { x: 19, y: 3 }] },
  ]
  map.flow = { style: 'LINEAR', entryRoomId: 'entry', objectiveRoomId: 'hall', exitRoomId: 'hall', routeRoomIds: ['entry', 'hall'] }
  const svg = renderEncounterMapSvg(map, options)
  expect(await renderedPixel(svg, 4.5 * 32, 6 * 32)).toEqual([198, 183, 151])
  expect(await renderedPixel(svg, 4.5 * 32, 12 * 32 - 1)).toEqual([198, 183, 151])
  expect(svg).toContain('data-portal-id="entrance"')
  expect(svg).toContain('data-portal-id="exit"')
  expect(svg).not.toContain('data-layer="flow"')
  expect(renderEncounterMapSvg(map)).toContain('>Entrance</text>')
  expect(renderEncounterMapSvg(map)).toContain('>Exit</text>')
  expect(renderEncounterMapSvg(map, { includeFlow: true })).toContain('data-layer="flow"')
  expect(renderEncounterMapSvg(toPlayerSafeMap(map), { includeFlow: true })).not.toContain('data-layer="flow"')
  map.portals.push({ id: 'hidden-access', kind: 'ENTRANCE', roomId: 'entry', isSecret: true, label: 'Concealed <hatch>', points: [{ x: 2, y: 2 }, { x: 0, y: 2 }] })
  const gmSvg = renderEncounterMapSvg(map, options)
  const playerSvg = renderEncounterMapSvg(toPlayerSafeMap(map), options)
  expect(gmSvg).toContain('Concealed &lt;hatch&gt;')
  expect(playerSvg).not.toContain('hidden-access')
  expect(playerSvg).not.toContain('Concealed')
  expect(await renderedPixel(gmSvg, 2 * 32, 2.5 * 32)).toEqual([198, 183, 151])
  expect(await renderedPixel(playerSvg, 2 * 32, 2.5 * 32)).not.toEqual([198, 183, 151])
  map.rooms[0]!.x = 0
  map.portals = [{ id: 'edge-entry', kind: 'ENTRANCE', roomId: 'entry', points: [{ x: 0, y: 3 }, { x: 0, y: 3 }] }]
  expect(await renderedPixel(renderEncounterMapSvg(map, options), 0, 3.5 * 32)).toEqual([198, 183, 151])
})

it('keeps every floor layer scoped while showing stair destinations on each connected level', () => {
  const map = exampleMap()
  map.mapType = 'BUILDING'
  map.floorCount = 3
  map.rooms.push(...map.rooms.map(room => ({ ...room, id: `${room.id}-upper`, roomNumber: room.roomNumber + 2, floor: 1 })))
  map.corridors.push({ ...map.corridors[0]!, id: 'upper-passage', fromRoomId: 'entry-upper', toRoomId: 'hall-upper' })
  map.doors = [
    { id: 'door', corridorId: 'passage', x: 6, y: 4, isLocked: false, isSecret: false, isSpecial: false },
    { id: 'upper-door', corridorId: 'upper-passage', x: 6, y: 4, isLocked: false, isSecret: false, isSpecial: false },
  ]
  map.walls = [{ id: 'upper-wall', floor: 1, x1: 15, y1: 2, x2: 15, y2: 3 }]
  map.terrain = [{ id: 'rock', kind: 'ROCK', floor: 1, x: 16, y: 2, width: 1, height: 1 }]
  map.zones = [{ id: 'zone', floor: 1, type: 'SAFE', label: 'Rest', cells: [{ x: 10, y: 2 }] }]
  map.stairs = [{ id: 'stairs', fromRoomId: 'entry', toRoomId: 'entry-upper', x: 3, y: 3, width: 2, height: 3 }]
  map.rooms.push({ ...map.rooms[0]!, id: 'entry-top', roomNumber: 5, floor: 2 })
  map.stairs.push({ id: 'stairs-top', fromRoomId: 'entry-upper', toRoomId: 'entry-top', x: 3, y: 3, width: 2, height: 3 })
  map.portals = [
    { id: 'entrance', kind: 'ENTRANCE', roomId: 'entry', points: [{ x: 2, y: 3 }, { x: 0, y: 3 }] },
    { id: 'upper-exit', kind: 'EXIT', roomId: 'hall-upper', points: [{ x: 13, y: 3 }, { x: 19, y: 3 }] },
  ]
  map.flow = { style: 'LINEAR', entryRoomId: 'entry', objectiveRoomId: 'hall-upper', exitRoomId: 'hall-upper', routeRoomIds: ['entry', 'entry-upper', 'hall-upper'] }
  const original = structuredClone(map)
  const upper = getEncounterMapFloorMap(map, 1)
  expect(upper.rooms.map(room => room.id)).toEqual(['entry-upper', 'hall-upper'])
  expect(upper.corridors.map(corridor => corridor.id)).toEqual(['upper-passage'])
  expect(upper.doors.map(door => door.id)).toEqual(['upper-door'])
  expect(upper.stairs).toEqual(map.stairs)
  expect(upper.portals!.map(portal => portal.id)).toEqual(['upper-exit'])
  expect(upper).not.toHaveProperty('flow')
  const ground = getEncounterMapFloorMap(map)
  expect(ground.walls).toEqual([])
  expect(ground.terrain).toEqual([])
  expect(ground.zones).toEqual([])
  const upperSvg = renderEncounterMapSvg(map, { floor: 1 })
  expect(upperSvg).toContain('data-room-id="entry-upper"')
  expect(upperSvg).not.toContain('data-room-id="entry"')
  expect(upperSvg).toContain('Down to floor 1')
  expect(upperSvg).toContain('Up to floor 3')
  expect(upperSvg.match(/data-stair-location=/g)).toHaveLength(1)
  expect(upperSvg).toContain('data-stair-width="2" data-stair-height="3"')
  expect(upperSvg).not.toContain('Up to floor 2')
  expect(renderEncounterMapSvg(map)).toContain('Up to floor 2')
  expect(map).toEqual(original)
})

it('renders distinct forest terrain and open clearings joined to trails and portals without visual gaps', async () => {
  const map = exampleMap()
  map.mapType = 'FOREST'
  map.width = 80
  map.height = 40
  Object.assign(map.rooms[0]!, { x: 2, y: 2, width: 36, height: 24 })
  Object.assign(map.rooms[1]!, { x: 50, y: 2, width: 20, height: 24 })
  map.corridors[0]!.points = [{ x: 37, y: 13 }, { x: 50, y: 13 }]
  map.portals = [{ id: 'entrance', kind: 'ENTRANCE', roomId: 'entry', points: [{ x: 2, y: 13 }, { x: 0, y: 13 }] }]
  map.terrain = ['TREE', 'ROCK', 'BRUSH'].map((kind, index) => ({
    id: kind, kind: kind as 'TREE' | 'ROCK' | 'BRUSH', x: 2 + index * 3, y: 30, width: 2, height: 2,
  }))
  const svg = renderEncounterMapSvg(map, { includeGrid: false, includeLabels: false })
  expect(svg).toContain('<path data-room-id="entry"')
  expect(svg).not.toContain('<rect data-room-id=')
  expect(svg).not.toContain('data-layer="corridor-walls"')
  for (const label of ['Tree', 'Rock', 'Brush']) expect(svg).toContain(`>${label}</title>`)
  expect(svg).toContain('data-layer="passages"')
  const { data, info } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  for (const x of [3.5 * 32, 36 * 32]) {
    const offset = (13.5 * 32 * info.width + x) * info.channels
    expect([...data.subarray(offset, offset + 3)]).toEqual([167, 164, 116])
  }
})

it('renders tactical surfaces, walkable bridge decking, named levels, balconies and distinct ladder connections', async () => {
  const map = exampleMap()
  map.corridors[0]!.kind = 'BRIDGE'
  map.floorCount = 2
  map.floorLabels = ['Basement', 'Ground floor']
  map.rooms.push(...map.rooms.map(room => ({ ...room, id: `${room.id}-upper`, roomNumber: room.roomNumber + 2, floor: 1 })))
  map.rooms[3]!.kind = 'BALCONY'
  map.stairs = [
    { id: 'stairs', fromRoomId: 'entry', toRoomId: 'entry-upper', x: 3, y: 3, width: 2, height: 3 },
    { id: 'ladder', kind: 'LADDER', fromRoomId: 'entry', toRoomId: 'entry-upper', x: 3, y: 3, width: 1, height: 1 },
  ]
  map.terrain = [
    { id: 'crate', kind: 'COVER', roomId: 'entry', label: 'Crates <script>', x: 2, y: 2, width: 1, height: 1, blocksMovement: true, blocksSight: true },
    { id: 'dais', kind: 'ELEVATION', roomId: 'hall', label: 'Platform', x: 10, y: 2, width: 2, height: 1, elevationFeet: 10 },
    { id: 'mud', kind: 'DIFFICULT', roomId: 'hall', label: 'Mud', x: 12, y: 2, width: 1, height: 1, blocksMovement: false, blocksSight: false },
    { id: 'pit', kind: 'HAZARD', roomId: 'hall-upper', floor: 1, label: 'Open pit', x: 12, y: 3, width: 1, height: 1, blocksMovement: true },
  ]
  const svg = renderEncounterMapSvg(map, { includeGrid: false })
  for (const kind of ['COVER', 'ELEVATION', 'DIFFICULT']) expect(svg).toContain(`data-terrain-kind="${kind}"`)
  expect(svg).not.toContain('data-terrain-kind="HAZARD"')
  expect(svg).toContain('Blocks movement')
  expect(svg).toContain('Blocks line of sight')
  expect(svg).toContain('data-sight-blocker="crate"')
  expect(svg).toContain('data-layer="terrain-key"')
  expect(svg).toContain('Crates &lt;script&gt;')
  expect(svg).toContain('+10 ft')
  expect(svg).toContain('data-bridge-id="passage"')
  expect(svg).toContain('data-stair-kind="LADDER"')
  expect(svg).toContain('data-stair-kind="STAIRS"')
  expect(svg.match(/data-stair-location=/g)).toHaveLength(2)
  expect(svg).toContain('Up to Ground floor')
  const upper = renderEncounterMapSvg(map, { floor: 1 })
  expect(upper).toContain('Down to Basement')
  expect(upper).toContain('data-room-kind="BALCONY"')
  expect(upper).toContain('data-terrain-kind="HAZARD"')
  map.floorLabels[0] = 'Basement <level>'
  expect(renderEncounterMapSvg(map, { floor: 1 })).toContain('Down to Basement &lt;level&gt;')
  const { data, info } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const color = (x: number, y: number) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)]
  expect(color(8 * 32 + 5, 4.5 * 32)).not.toEqual(color(8 * 32 + 5, 3.5 * 32))
  expect(color(8 * 32 + 5, 3.5 * 32)).not.toEqual([48, 44, 39])

  // Portable maps can be smaller than generated maps. Their sight key still fits
  // inside the canvas and remains available in labeled visual exports.
  for (const size of [1, 4]) {
    const imported = encounterMapSchema.parse({
      ...exampleMap(), width: size, height: size,
      rooms: [{ ...map.rooms[0]!, x: 0, y: 0, width: size, height: size }],
      corridors: [],
      terrain: [{ id: 'tree', kind: 'TREE', x: 0, y: 0, width: 1, height: 1, blocksSight: true }],
    })
    const smallSvg = renderEncounterMapSvg(imported)
    expect(smallSvg).toContain('data-sight-blocker="tree"')
    expect(smallSvg).toContain('Blocks sight</text>')
    const keyTransform = smallSvg.match(/data-layer="terrain-key" transform="translate\(([^ ]+) ([^)]+)\) scale\(([^)]+)\)"/)!
    const [, x, y, scale] = keyTransform.map(Number)
    expect(x).toBeGreaterThanOrEqual(0)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(x! + imported.cellSize * 4.3 * scale!).toBeLessThanOrEqual(size * imported.cellSize)
    expect(y! + imported.cellSize * 0.8 * scale!).toBeLessThanOrEqual(size * imported.cellSize)
    expect(await sharp(Buffer.from(smallSvg)).metadata()).toMatchObject({ width: size * 32, height: size * 32 })
    expect(renderEncounterMapSvg(imported, { includeLabels: false })).not.toContain('data-layer="terrain-key"')
    expect(renderEncounterMapSvg(imported, { includeKey: false })).not.toContain('data-layer="terrain-key"')
  }
})

it('keeps long room labels inside narrow rooms rather than drawing into adjacent space', async () => {
  const map = exampleMap()
  map.rooms = [{ ...map.rooms[0]!, width: 2, height: 8, label: 'Reception and records office' }]
  map.corridors = []
  const withoutLabels = renderEncounterMapSvg(map, { includeGrid: false, includeLabels: false })
  const withLabels = renderEncounterMapSvg(map, { includeGrid: false })
  const outside = { left: 4 * 32 + 8, top: 2 * 32, width: 6 * 32, height: 8 * 32 }
  const before = await sharp(Buffer.from(withoutLabels)).extract(outside).raw().toBuffer()
  const after = await sharp(Buffer.from(withLabels)).extract(outside).raw().toBuffer()
  expect(after).toEqual(before)
  expect(withLabels).toContain('Reception and records office</title>')
})

it('builds a per-floor legend from the same symbols the map draws', () => {
  const map = exampleMap()
  map.floorCount = 2
  map.rooms.push({ id: 'attic', roomNumber: 3, x: 2, y: 2, width: 4, height: 4, isSecret: true, floor: 1 })
  map.doors = [{ id: 'door', x: 6, y: 4, corridorId: 'passage', isLocked: true, isSecret: false, isSpecial: false }]
  map.stairs = [{ id: 'ladder', kind: 'LADDER', fromRoomId: 'entry', toRoomId: 'attic', x: 3, y: 3 }]
  map.terrain = [
    { id: 'crates', kind: 'COVER', roomId: 'entry', label: 'Crates', x: 2, y: 2, width: 1, height: 1, blocksSight: true },
    { id: 'pit', kind: 'HAZARD', roomId: 'attic', floor: 1, label: 'Pit', x: 3, y: 4, width: 1, height: 1 },
  ]
  map.portals = [{ id: 'way-in', kind: 'ENTRANCE', roomId: 'entry', points: [{ x: 2, y: 5 }, { x: 0, y: 5 }] }]
  map.flow = { style: 'LINEAR', entryRoomId: 'entry', objectiveRoomId: 'hall', exitRoomId: 'entry', routeRoomIds: ['entry', 'hall', 'entry'] }
  const labels = (sections: ReturnType<typeof renderEncounterMapLegend>) =>
    Object.fromEntries(sections.map(section => [section.title, section.items.map(item => item.label)]))

  const ground = renderEncounterMapLegend(map)
  expect(labels(ground)).toEqual({
    Layout: ['Room', 'Passage'],
    Access: ['Locked door', 'Entrance', 'Ladder'],
    Terrain: ['Cover', 'Blocks sight'],
  })
  const svg = renderEncounterMapSvg(map)
  // Swatches reuse the drawing code, so their distinctive paint appears on the map too.
  const crate = ground.find(section => section.title === 'Terrain')!.items[0]!
  for (const paint of crate.content.match(/fill="#[0-9a-f]{6}"/g)!.filter(fill => fill !== 'fill="#c6b797"')) expect(svg).toContain(paint)
  expect(labels(renderEncounterMapLegend(map, { includeFlow: true })).Route).toEqual(['Encounter route', 'Objective'])

  const upper = labels(renderEncounterMapLegend(map, { floor: 1 }))
  expect(upper).toEqual({ Layout: ['Room', 'Secret room'], Access: ['Ladder'], Terrain: ['Hazard'] })
  expect(labels(renderEncounterMapLegend(map, { floor: 1, includeFlow: true })).Route).toBeUndefined()
})
