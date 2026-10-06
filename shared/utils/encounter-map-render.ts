import type { EncounterMapDoorGeometry, EncounterMapData, EncounterMapType, EncounterMapTerrainFeature } from '../types/encounter-map'
import { getEncounterMapFloorMap } from './encounter-map'

type RenderOptions = {
  floor?: number
  includeGrid?: boolean
  includeLabels?: boolean
  includeFlow?: boolean
  /** Draws the "Blocks sight" key into the image; views with a separate legend omit it. */
  includeKey?: boolean
}

const escapeXml = (value: string | number) => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[character]!))

// Only our fixed SVG elements are emitted; every attribute and text value is escaped.
const svgElement = (tag: string, attributes: Record<string, string | number>, content = '') =>
  `<${tag} ${Object.entries(attributes).map(([key, value]) => `${key}="${escapeXml(value)}"`).join(' ')}>${content}</${tag}>`

export const encounterMapPalette = (mapType?: EncounterMapType) => ({
  ground: mapType === 'FOREST' ? '#69734c' : mapType === 'BUILDING' ? '#85816b' : '#302c27',
  surface: mapType === 'FOREST' ? '#a7a474' : mapType === 'BUILDING' ? '#d6be93' : '#c6b797',
  wall: mapType === 'BUILDING' ? '#57452f' : '#615444',
})

export const renderEncounterMapDoorSymbol = (cell: number, door: Pick<EncounterMapDoorGeometry, 'isSecret' | 'isLocked'>) =>
  svgElement('title', {}, `${door.isSecret ? 'Secret ' : ''}${door.isLocked ? 'locked door' : 'door'}`)
  + svgElement('rect', { x: -cell * 0.4, y: -cell * 0.1, width: cell * 0.8, height: cell * 0.2, fill: '#8d633a', stroke: door.isSecret ? '#c17526' : '#493a29', 'stroke-width': 2, 'stroke-dasharray': door.isSecret ? '3 2' : 'none' })
  + (door.isLocked ? svgElement('circle', { cx: 0, cy: 0, r: 2.5, fill: '#392c21' }) : '')

// Symbols below are shared by the map and its legend, so the legend always matches the drawing.
const sightMarker = (cell: number, x: number, y: number, radius = cell * 0.23) => svgElement('g', { transform: `translate(${x} ${y})` },
  svgElement('circle', { cx: 0, cy: 0, r: radius, fill: '#eee3c5', stroke: '#514936', 'stroke-width': 1 })
  + svgElement('path', { d: `M${-radius * 0.7},0 Q0,${-radius * 0.75} ${radius * 0.7},0 Q0,${radius * 0.75} ${-radius * 0.7},0 M${-radius * 0.6},${radius * 0.65} L${radius * 0.6},${-radius * 0.65}`, fill: 'none', stroke: '#3e392c', 'stroke-width': 1.25 }))

const arrowPath = (cell: number) => `M${-cell * 0.16},${-cell * 0.18} L${cell * 0.16},0 L${-cell * 0.16},${cell * 0.18}`

export type EncounterMapTerrainVariant = 'difficult' | 'hazard' | 'elevation' | 'pillar' | 'crate' | 'rock' | 'brush' | 'tree'
/** Terrain kinds and labels map to these distinct drawings. */
export const encounterMapTerrainVariant = (terrain: Pick<EncounterMapTerrainFeature, 'kind' | 'label'>, forest: boolean): EncounterMapTerrainVariant => {
  if (terrain.kind === 'DIFFICULT') return 'difficult'
  if (terrain.kind === 'HAZARD') return 'hazard'
  if (terrain.kind === 'ELEVATION') return 'elevation'
  if (terrain.kind === 'COVER' && /pillar|column/i.test(terrain.label ?? '')) return 'pillar'
  if (terrain.kind === 'COVER' && !/rock|boulder/i.test(terrain.label ?? '') && !forest) return 'crate'
  if (terrain.kind === 'ROCK' || terrain.kind === 'COVER') return 'rock'
  if (terrain.kind === 'BRUSH') return 'brush'
  return 'tree'
}

const terrainNames = { TREE: 'Tree', ROCK: 'Rock', BRUSH: 'Brush', COVER: 'Cover', ELEVATION: 'High ground', DIFFICULT: 'Difficult terrain', HAZARD: 'Hazard' }
const renderTerrain = (terrain: EncounterMapTerrainFeature, cell: number, forest: boolean, includeLabels: boolean) => {
  const x = (terrain.x + terrain.width / 2) * cell
  const y = (terrain.y + terrain.height / 2) * cell
  const rx = terrain.width * cell / 2
  const ry = terrain.height * cell / 2
  const mechanics = [
    terrain.label ? `${terrainNames[terrain.kind]}: ${terrain.label}` : terrainNames[terrain.kind],
    ...(terrain.elevationFeet !== undefined ? [`Elevation ${terrain.elevationFeet >= 0 ? '+' : ''}${terrain.elevationFeet} ft`] : []),
    ...(terrain.blocksMovement ? ['Blocks movement'] : terrain.blocksMovement === false ? ['Movement permitted'] : []),
    ...(terrain.blocksSight ? ['Blocks line of sight'] : terrain.blocksSight === false ? ['Clear line of sight'] : []),
  ]
  const title = svgElement('title', {}, escapeXml(mechanics.join('; ')))
  const attributes = { 'data-terrain-id': terrain.id, 'data-terrain-kind': terrain.kind }
  const left = x - rx
  const top = y - ry
  const inset = Math.min(4, cell * 0.12)
  const hatch = (color: string) => {
    const lines = []
    for (let offset = -ry * 2; offset < rx * 2; offset += cell * 0.3) {
      lines.push(svgElement('line', {
        x1: left + Math.max(0, offset), y1: top + Math.max(0, -offset),
        x2: left + Math.min(rx * 2, offset + ry * 2), y2: top + Math.min(ry * 2, rx * 2 - offset),
        stroke: color, 'stroke-width': 1.5, opacity: 0.7,
      }))
    }
    return lines.join('')
  }
  switch (encounterMapTerrainVariant(terrain, forest)) {
    case 'difficult': return svgElement('g', attributes, title
      + svgElement('rect', { x: left, y: top, width: rx * 2, height: ry * 2, rx: 5, fill: '#9c916c', stroke: '#776b4f', 'stroke-width': 1, 'stroke-dasharray': '4 3' })
      + hatch('#6e624a')
      + [-0.4, 0.3].map(offset => svgElement('ellipse', { cx: x + rx * offset, cy: y - ry * offset, rx: cell * 0.12, ry: cell * 0.08, fill: '#b8ae8d', stroke: '#776b4f', 'stroke-width': 1 })).join(''))
    case 'hazard': return svgElement('g', attributes, title
      + svgElement('rect', { x: left + 1, y: top + 1, width: rx * 2 - 2, height: ry * 2 - 2, fill: '#6b493d', stroke: '#332824', 'stroke-width': 2 })
      + hatch('#a17546')
      + svgElement('path', { d: `M${x},${y - cell * 0.27} L${x + cell * 0.3},${y + cell * 0.24} H${x - cell * 0.3} Z`, fill: '#e8c36a', stroke: '#53352b', 'stroke-width': 1.5 })
      + svgElement('path', { d: `M${x},${y - cell * 0.1} V${y + cell * 0.07}`, stroke: '#53352b', 'stroke-width': 2 })
      + svgElement('circle', { cx: x, cy: y + cell * 0.15, r: 1.4, fill: '#53352b' }))
    case 'elevation': {
      const label = terrain.elevationFeet !== undefined ? `${terrain.elevationFeet >= 0 ? '+' : ''}${terrain.elevationFeet} ft` : 'Raised'
      return svgElement('g', attributes, title
        + svgElement('rect', { x: left, y: top, width: rx * 2, height: ry * 2, fill: '#837761', stroke: '#5e5341', 'stroke-width': 2 })
        + svgElement('rect', { x: left + inset, y: top + inset, width: rx * 2 - inset * 2, height: ry * 2 - inset * 2, fill: '#c9c0a6', stroke: '#e3d8b9', 'stroke-width': 1.5 })
        + (includeLabels ? svgElement('text', { x, y, fill: '#302a1f', 'font-size': Math.min(12, cell * 0.36), 'font-family': 'sans-serif', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, escapeXml(label)) : ''))
    }
    case 'pillar': return svgElement('g', attributes, title
      + svgElement('ellipse', { cx: x + 2, cy: y + 3, rx: rx * 0.8, ry: ry * 0.8, fill: '#504837', opacity: 0.4 })
      + svgElement('ellipse', { cx: x, cy: y, rx: rx * 0.8, ry: ry * 0.8, fill: '#a9a28e', stroke: '#696453', 'stroke-width': 2 })
      + svgElement('ellipse', { cx: x, cy: y, rx: rx * 0.52, ry: ry * 0.52, fill: '#d7cfb9', stroke: '#827b67', 'stroke-width': 1 }))
    case 'crate': return svgElement('g', attributes, title
      + svgElement('rect', { x: left + inset, y: top + inset, width: rx * 2 - inset * 2, height: ry * 2 - inset * 2, fill: '#aa7d43', stroke: '#604b2e', 'stroke-width': 2 })
      + svgElement('path', { d: `M${left + inset},${top + inset} L${x + rx - inset},${y + ry - inset} M${x + rx - inset},${top + inset} L${left + inset},${y + ry - inset}`, stroke: '#ddaf6f', 'stroke-width': 3 }))
    case 'rock': return svgElement('g', attributes, title + svgElement('polygon', {
      points: `${x - rx},${y + ry * 0.1} ${x - rx * 0.5},${y - ry} ${x + rx * 0.6},${y - ry * 0.8} ${x + rx},${y + ry * 0.35} ${x + rx * 0.15},${y + ry}`,
      fill: '#96988b', stroke: '#555d52', 'stroke-width': 2,
    }) + svgElement('path', { d: `M${x - rx * 0.5},${y - ry} L${x + rx * 0.1},${y} L${x + rx},${y + ry * 0.35}`, fill: 'none', stroke: '#bfc0b3', 'stroke-width': 2 }))
    case 'brush': return svgElement('g', attributes, title + [-0.4, 0.35, 0].map((offset, index) =>
      svgElement('ellipse', { cx: x + rx * offset, cy: y + (index % 2 ? ry * 0.25 : -ry * 0.1), rx: rx * 0.65, ry: ry * 0.65, fill: '#697d43', stroke: '#4c6038', 'stroke-width': 1 })).join(''))
    case 'tree': {
      const radius = Math.min(rx, ry) * 0.9
      const count = Math.ceil(Math.max(rx, ry) / Math.min(rx, ry))
      return svgElement('g', attributes, title + Array.from({ length: count }, (_, index) => {
        const offset = count === 1 ? 0 : (index / (count - 1) - 0.5) * (Math.max(rx, ry) - radius) * 2
        const cx = x + (rx > ry ? offset : 0)
        const cy = y + (ry > rx ? offset : 0)
        return svgElement('circle', { cx: cx + 3, cy: cy + 4, r: radius, fill: '#34492f', opacity: 0.3 })
          + svgElement('circle', { cx, cy, r: radius, fill: '#395c38', stroke: '#294630', 'stroke-width': 2 })
          + [-0.35, 0.35].map(shift => svgElement('circle', { cx: cx + radius * shift, cy: cy - radius * 0.2, r: radius * 0.6, fill: '#4a7040' })).join('')
          + svgElement('circle', { cx, cy, r: radius * 0.1, fill: '#6e5836' })
      }).join(''))
    }
  }
}

const renderLadder = (cell: number) =>
  svgElement('rect', { x: 2, y: 2, width: cell - 4, height: cell - 4, fill: '#534733', stroke: '#2f2b22', 'stroke-width': 1.5 })
  + [0.25, 0.75].map(offset => svgElement('line', { x1: cell * offset, y1: cell * 0.1, x2: cell * offset, y2: cell * 0.9, stroke: '#dbc193', 'stroke-width': 3 })).join('')
  + [0.25, 0.5, 0.75].map(offset => svgElement('line', { x1: cell * 0.25, y1: cell * offset, x2: cell * 0.75, y2: cell * offset, stroke: '#dbc193', 'stroke-width': 2 })).join('')

const STAIR_DIRECTION_COLOR = '#423523'
/** An upright stair flight `breadth` wide and `length` long, with one arrow per destination. */
const renderStairFlight = (cell: number, breadth: number, length: number, wallColor: string, ups: boolean[]) => {
  const hasLandings = breadth >= cell * 1.5 && length >= cell * 2.5
  const landing = hasLandings ? Math.min(cell * 0.9, length * 0.25) : cell * 0.12
  const flightLength = length - landing * 2
  const steps = Math.max(4, Math.round(flightLength / (cell * 0.25)))
  const content = svgElement('rect', { x: 0, y: 0, width: breadth, height: length, fill: '#eee0ba', stroke: wallColor, 'stroke-width': 2 })
    + Array.from({ length: steps + 1 }, (_, index) => svgElement('line', {
      x1: 2, y1: landing + index * flightLength / steps, x2: breadth - 2, y2: landing + index * flightLength / steps,
      stroke: '#8a7450', 'stroke-width': 1,
    })).join('')
    + ups.map((up, index) => {
      const x = breadth * (ups.length === 1 ? 0.5 : index === 0 ? 0.32 : 0.68)
      const startY = up ? length - landing - 3 : landing + 3
      const endY = up ? landing + 3 : length - landing - 3
      const arrowY = endY + (up ? 1 : -1) * cell * 0.2
      return svgElement('path', {
        d: `M${x},${startY} V${endY} M${x - cell * 0.12},${arrowY} L${x},${endY} L${x + cell * 0.12},${arrowY}`,
        fill: 'none', stroke: STAIR_DIRECTION_COLOR, 'stroke-width': 2,
      })
    }).join('')
  return { content, hasLandings, landing }
}

const renderBridgeTile = (cell: number) =>
  svgElement('rect', { x: -cell / 2, y: -cell * 0.4, width: cell, height: cell * 0.8, fill: '#b78e5b' })
  + [-0.3, 0, 0.3].map(offset => svgElement('line', { x1: cell * offset, y1: -cell * 0.4, x2: cell * offset, y2: cell * 0.4, stroke: '#795736', 'stroke-width': 1 })).join('')
  + [-0.43, 0.43].map(offset => svgElement('line', { x1: -cell / 2, y1: cell * offset, x2: cell / 2, y2: cell * offset, stroke: '#4b3826', 'stroke-width': 3 })).join('')

const renderBalcony = (cell: number, left: number, top: number, columns: number, rows: number) => {
  const deckWidth = columns * cell
  const deckHeight = rows * cell
  const boards = Array.from({ length: rows * 3 }, (_, index) => svgElement('line', {
    x1: left, y1: top + index * cell / 3, x2: left + deckWidth, y2: top + index * cell / 3,
    stroke: '#aa8151', 'stroke-width': 1,
  })).join('')
  const posts = []
  for (let x = 0; x <= columns; x += 1) {
    for (const y of [0, rows]) posts.push(svgElement('circle', { cx: left + x * cell, cy: top + y * cell, r: 3, fill: '#57452f' }))
  }
  for (let y = 1; y < rows; y += 1) {
    for (const x of [0, columns]) posts.push(svgElement('circle', { cx: left + x * cell, cy: top + y * cell, r: 3, fill: '#57452f' }))
  }
  return svgElement('rect', { x: left, y: top, width: deckWidth, height: deckHeight, fill: '#d4ad78', stroke: '#57452f', 'stroke-width': 2 })
    + boards + posts.join('')
}

const CLEARING_PATH = 'M.42,.04 C.68,0 .94,.12 .91,.39 C1,.62 .85,.94 .62,.91 C.39,1 .12,.94 .08,.72 C0,.51 .09,.27 .2,.23 C.22,.12 .28,.06 .42,.04 Z'
const SECRET_ROOM_STROKE = '#a65f3d'
const ROUTE_COLOR = '#175e68'
const portalColor = (portal: { kind: 'ENTRANCE' | 'EXIT'; isSecret?: boolean }) =>
  portal.isSecret ? '#976624' : portal.kind === 'ENTRANCE' ? '#174e52' : '#703a27'

/** The canvas, minimap and image exports share this floor geometry and drawing order. */
export const renderEncounterMapSvg = (map: EncounterMapData, options: RenderOptions = {}) => {
  const floor = options.floor ?? 0
  const visible = getEncounterMapFloorMap(map, floor)
  const forest = map.mapType === 'FOREST'
  const cell = map.cellSize
  const width = map.width * cell
  const height = map.height * cell
  const { ground, surface, wall: wallColor } = encounterMapPalette(map.mapType)
  const roomById = new Map(map.rooms.map(room => [room.id, room]))
  const roomCenter = (room: EncounterMapData['rooms'][number]) => ({ x: room.x + (room.width - 1) / 2, y: room.y + (room.height - 1) / 2 })
  const pixel = (value: number) => (value + 0.5) * cell
  const corridorWidth = cell * (forest ? 1.3 : 0.8)
  // Organic clearing outlines sit inside their bounds. Continue trails into their
  // centers so the visual floor stays connected to stored wall-cell endpoints.
  const passages = visible.corridors.map(passage => forest ? {
    ...passage,
    points: [roomCenter(roomById.get(passage.fromRoomId)!), ...passage.points, roomCenter(roomById.get(passage.toRoomId)!)],
  } : passage)
  const portals = (visible.portals ?? []).map(portal => {
    const points = portal.points.map(point => ({ ...point }))
    if (forest) points.unshift(roomCenter(roomById.get(portal.roomId)!))
    const boundary = points.at(-1)!
    const before = points.at(-2)!
    const horizontal = before.x !== boundary.x || before.y === boundary.y
    if (horizontal && boundary.x === 0) boundary.x -= 0.5
    else if (horizontal && boundary.x === map.width - 1) boundary.x += 0.5
    else if (boundary.y === 0) boundary.y -= 0.5
    else if (boundary.y === map.height - 1) boundary.y += 0.5
    return { ...portal, points }
  })
  const corridor = (points: Array<{ x: number; y: number }>, color: string, strokeWidth: number) => {
    const pixels = points.map(point => ({ x: pixel(point.x), y: pixel(point.y) }))
    let path = `M${pixels[0]!.x},${pixels[0]!.y}`
    for (let index = 1; index < pixels.length - 1; index += 1) {
      const before = pixels[index - 1]!
      const point = pixels[index]!
      const after = pixels[index + 1]!
      const distanceBefore = Math.hypot(point.x - before.x, point.y - before.y)
      const distanceAfter = Math.hypot(after.x - point.x, after.y - point.y)
      const radius = Math.min(cell * 0.75, distanceBefore / 2, distanceAfter / 2)
      const fromX = point.x + (before.x - point.x) * radius / (distanceBefore || 1)
      const fromY = point.y + (before.y - point.y) * radius / (distanceBefore || 1)
      const toX = point.x + (after.x - point.x) * radius / (distanceAfter || 1)
      const toY = point.y + (after.y - point.y) * radius / (distanceAfter || 1)
      path += ` L${fromX},${fromY} Q${point.x},${point.y} ${toX},${toY}`
    }
    path += ` L${pixels.at(-1)!.x},${pixels.at(-1)!.y}`
    return svgElement(forest ? 'path' : 'polyline', {
      ...(forest ? { d: path } : { points: pixels.map(point => `${point.x},${point.y}`).join(' ') }),
      fill: 'none', stroke: color, 'stroke-width': strokeWidth,
      'stroke-linecap': forest ? 'round' : 'square', 'stroke-linejoin': 'round',
    })
  }
  const directionArrow = (points: Array<{ x: number; y: number }>, color: string, position = 0.5) => {
    const segment = points.slice(1).map((to, index) => ({ from: points[index]!, to }))
      .sort((a, b) => Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y) - Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y))[0]
    if (!segment) return ''
    const angle = Math.atan2(segment.to.y - segment.from.y, segment.to.x - segment.from.x) * 180 / Math.PI
    return svgElement('path', {
      transform: `translate(${pixel(segment.from.x + (segment.to.x - segment.from.x) * position)} ${pixel(segment.from.y + (segment.to.y - segment.from.y) * position)}) rotate(${angle})`,
      d: arrowPath(cell),
      stroke: color, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    })
  }
  const layers = [svgElement('rect', { width, height, fill: ground })]
  const bridges = visible.corridors.filter(passage => passage.kind === 'BRIDGE')
  layers.push(svgElement('g', { 'data-layer': 'bridge-gaps' }, bridges.map(bridge =>
    corridor(bridge.points, forest ? '#496b74' : '#181c20', cell * 2.8)).join('')))

  if (!forest) {
    layers.push(svgElement('g', { 'data-layer': 'corridor-walls' }, [...passages, ...portals].map(item =>
      corridor(item.points, wallColor, corridorWidth + 5)).join('')))
  }
  layers.push(svgElement('g', { 'data-layer': 'rooms' }, visible.rooms.map(room => {
    const title = svgElement('title', {}, escapeXml(room.label || `Room ${room.roomNumber}`))
    if (room.kind === 'BALCONY') {
      return svgElement('g', { 'data-room-id': room.id, 'data-room-kind': 'BALCONY' }, title
        + renderBalcony(cell, room.x * cell, room.y * cell, room.width, room.height))
    }
    return forest
      ? svgElement('path', {
          'data-room-id': room.id,
          transform: `translate(${room.x * cell} ${room.y * cell}) scale(${room.width * cell} ${room.height * cell})`,
          d: CLEARING_PATH,
          fill: surface,
        }, title)
      : svgElement('rect', {
          'data-room-id': room.id,
          x: room.x * cell, y: room.y * cell, width: room.width * cell, height: room.height * cell,
          fill: surface, stroke: room.isSecret ? SECRET_ROOM_STROKE : wallColor, 'stroke-width': 5,
          'stroke-dasharray': room.isSecret ? '6 3' : 'none',
        }, title)
  }).join('')))

  // Corridor floors cross room boundaries after walls are drawn, opening each entrance.
  layers.push(svgElement('g', { 'data-layer': 'passages' }, passages.map(item =>
    corridor(item.points, surface, item.kind === 'BRIDGE' ? cell * 0.8 : corridorWidth)).join('')))

  layers.push(svgElement('g', { 'data-layer': 'portals' }, portals.map(portal =>
    svgElement('g', { 'data-portal-id': portal.id }, corridor(portal.points, surface, corridorWidth))).join('')))

  if (options.includeGrid !== false) {
    const lines = []
    for (let x = cell; x < width; x += cell) lines.push(svgElement('line', { x1: x, y1: 0, x2: x, y2: height }))
    for (let y = cell; y < height; y += cell) lines.push(svgElement('line', { x1: 0, y1: y, x2: width, y2: y }))
    layers.push(svgElement('g', { 'data-layer': 'grid', stroke: '#302c27', 'stroke-opacity': 0.16, 'stroke-width': 1 }, lines.join('')))
  }

  layers.push(svgElement('g', { 'data-layer': 'bridges' }, bridges.map(bridge => {
    const tiles = new Map<string, { x: number; y: number; horizontal: boolean }>()
    for (let index = 1; index < bridge.points.length; index += 1) {
      const from = bridge.points[index - 1]!
      const to = bridge.points[index]!
      const distance = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
      for (let step = 0; step <= distance; step += 1) {
        const x = from.x + Math.sign(to.x - from.x) * step
        const y = from.y + Math.sign(to.y - from.y) * step
        if (visible.rooms.some(room => x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height)) continue
        tiles.set(`${x},${y}`, { x, y, horizontal: from.y === to.y })
      }
    }
    return svgElement('g', { 'data-bridge-id': bridge.id }, svgElement('title', {}, forest ? 'Bridge over a stream' : 'Bridge over a gap')
      + [...tiles.values()].map(tile => {
        return svgElement('g', { transform: `translate(${pixel(tile.x)} ${pixel(tile.y)}) rotate(${tile.horizontal ? 0 : 90})` }, renderBridgeTile(cell))
      }).join(''))
  }).join('')))

  layers.push(svgElement('g', { 'data-layer': 'walls', stroke: wallColor, 'stroke-width': 5, 'stroke-linecap': 'square' }, visible.walls.map(wall =>
    svgElement('line', { x1: wall.x1 * cell, y1: wall.y1 * cell, x2: wall.x2 * cell, y2: wall.y2 * cell })).join('')))

  layers.push(svgElement('g', { 'data-layer': 'terrain' }, (visible.terrain ?? []).map(terrain =>
    renderTerrain(terrain, cell, forest, options.includeLabels !== false)).join('')))

  const sightBlockers = (visible.terrain ?? []).filter(terrain => terrain.blocksSight)
  layers.push(svgElement('g', { 'data-layer': 'sight-markers' }, sightBlockers.map(terrain =>
    svgElement('g', { 'data-sight-blocker': terrain.id }, svgElement('title', {}, 'Blocks line of sight')
      + sightMarker(cell, (terrain.x + terrain.width - 0.22) * cell, (terrain.y + 0.22) * cell))).join('')))

  if (options.includeFlow && map.flow) {
    const paths: Array<Array<{ x: number; y: number }>> = []
    for (let index = 1; index < map.flow.routeRoomIds.length; index += 1) {
      const from = roomById.get(map.flow.routeRoomIds[index - 1]!)
      const to = roomById.get(map.flow.routeRoomIds[index]!)
      if (!from || !to) continue
      if ((from.floor ?? 0) === floor && (to.floor ?? 0) === floor) {
        const passage = visible.corridors.find(item =>
          (item.fromRoomId === from.id && item.toRoomId === to.id) || (item.toRoomId === from.id && item.fromRoomId === to.id))
        if (passage) paths.push([roomCenter(from), ...(passage.fromRoomId === from.id ? passage.points : [...passage.points].reverse()), roomCenter(to)])
      } else if ((from.floor ?? 0) === floor || (to.floor ?? 0) === floor) {
        const stair = visible.stairs?.find(item =>
          (item.fromRoomId === from.id && item.toRoomId === to.id) || (item.toRoomId === from.id && item.fromRoomId === to.id))
        if (!stair) continue
        const center = { x: stair.x + ((stair.width ?? 1) - 1) / 2, y: stair.y + ((stair.height ?? 1) - 1) / 2 }
        paths.push((from.floor ?? 0) === floor ? [roomCenter(from), center] : [center, roomCenter(to)])
      }
    }
    for (const portal of portals.filter(portal => !portal.isSecret)) {
      const points = [roomCenter(roomById.get(portal.roomId)!), ...portal.points]
      paths.push(portal.kind === 'ENTRANCE' ? points.reverse() : points)
    }
    const distinctPaths = new Map<string, { points: Array<{ x: number; y: number }>; bidirectional: boolean; direction: string }>()
    for (const points of paths) {
      const direction = points.map(point => `${point.x},${point.y}`).join(' ')
      const reverse = [...points].reverse().map(point => `${point.x},${point.y}`).join(' ')
      const key = [direction, reverse].sort()[0]!
      const previous = distinctPaths.get(key)
      if (previous) previous.bidirectional ||= direction !== previous.direction
      else distinctPaths.set(key, { points, bidirectional: false, direction })
    }
    const routes = [...distinctPaths.values()]
    const objective = visible.rooms.find(room => room.id === map.flow!.objectiveRoomId)
    const objectiveMark = objective ? svgElement('g', { 'data-flow-objective': objective.id },
      svgElement('title', {}, 'Encounter objective')
      + svgElement('circle', { cx: (objective.x + (forest ? objective.width / 2 : 0.55)) * cell, cy: (objective.y + (forest ? objective.height * 0.35 : 0.55)) * cell, r: cell * 0.22, fill: '#dcad49', stroke: '#745120', 'stroke-width': 2 })) : ''
    layers.push(svgElement('g', { 'data-layer': 'flow' },
      svgElement('g', { 'stroke-dasharray': `${cell * 0.24} ${cell * 0.14}` }, routes.map(({ points }) => corridor(points, ROUTE_COLOR, 3)).join(''))
      + routes.map(({ points, bidirectional }) => directionArrow(points, ROUTE_COLOR, bidirectional ? 0.3 : 0.5)
        + (bidirectional ? directionArrow([...points].reverse(), ROUTE_COLOR, 0.3) : '')).join('') + objectiveMark))
  }

  layers.push(svgElement('g', { 'data-layer': 'doors' }, visible.doors.map(door => {
    const passage = visible.corridors.find(item => item.id === door.corridorId)
    const segments = passage?.points.slice(1).map((point, index) => ({ from: passage.points[index]!, to: point })) ?? []
    const nearest = segments.sort((a, b) => {
      const distance = (segment: typeof a) => {
        const dx = segment.to.x - segment.from.x
        const dy = segment.to.y - segment.from.y
        const t = Math.max(0, Math.min(1, ((door.x - segment.from.x) * dx + (door.y - segment.from.y) * dy) / (dx * dx + dy * dy || 1)))
        return Math.hypot(door.x - segment.from.x - t * dx, door.y - segment.from.y - t * dy)
      }
      return distance(a) - distance(b)
    })[0]
    const vertical = nearest && Math.abs(nearest.to.x - nearest.from.x) > Math.abs(nearest.to.y - nearest.from.y)
    // Generated doors sit in the cell beside an entrance; place the symbol on its wall.
    const crossings: Array<{ x: number; y: number }> = []
    for (const roomId of passage ? [passage.fromRoomId, passage.toRoomId] : []) {
      const room = roomById.get(roomId)!
      for (const segment of segments) {
        const x1 = segment.from.x + 0.5
        const y1 = segment.from.y + 0.5
        const x2 = segment.to.x + 0.5
        const y2 = segment.to.y + 0.5
        if (y1 === y2 && y1 >= room.y && y1 <= room.y + room.height) {
          for (const x of [room.x, room.x + room.width]) {
            if (x >= Math.min(x1, x2) && x <= Math.max(x1, x2)) crossings.push({ x, y: y1 })
          }
        }
        if (x1 === x2 && x1 >= room.x && x1 <= room.x + room.width) {
          for (const y of [room.y, room.y + room.height]) {
            if (y >= Math.min(y1, y2) && y <= Math.max(y1, y2)) crossings.push({ x: x1, y })
          }
        }
      }
    }
    const distance = (point: { x: number; y: number }) => Math.hypot(point.x - door.x - 0.5, point.y - door.y - 0.5)
    const crossing = crossings.sort((a, b) => distance(a) - distance(b))[0]
    const position = crossing && distance(crossing) <= 0.75 ? crossing : { x: door.x + 0.5, y: door.y + 0.5 }
    return svgElement('g', { transform: `translate(${position.x * cell} ${position.y * cell}) rotate(${vertical ? 90 : 0})` },
      renderEncounterMapDoorSymbol(cell, door))
  }).join('')))

  const portalLabelBounds: Array<{ x: number; y: number; width: number; height: number }> = []
  layers.push(svgElement('g', { 'data-layer': 'portal-markers' }, portals.map(portal => {
    const end = portal.points.at(-1)!
    const before = portal.points.at(-2)!
    const horizontal = end.y === before.y
    const label = portal.label || (portal.isSecret ? 'Concealed entrance' : portal.kind === 'ENTRANCE' ? 'Entrance' : 'Exit')
    const color = portalColor(portal)
    const boundaryPoints = [before, end]
    const arrow = directionArrow(portal.kind === 'ENTRANCE' ? boundaryPoints.reverse() : boundaryPoints, color)
    const fontSize = Math.max(10, Math.min(cell * 0.5, (width - cell) / Math.max(1, label.length * 0.64)))
    const labelWidth = label.length * fontSize * 0.64 + 6
    const x = horizontal ? end.x < 0 ? cell * 0.45 : width - cell * 0.45 : Math.min(width - labelWidth - cell * 0.45, Math.max(cell * 0.45, pixel(end.x) + cell * 0.6))
    const y = horizontal ? Math.max(cell * 0.7, pixel(end.y) - cell * 0.5) : end.y < 0 ? cell * 0.7 : height - cell * 0.35
    portalLabelBounds.push({ x: horizontal && end.x > 0 ? x - labelWidth : x, y: y - fontSize, width: labelWidth, height: fontSize * 1.2 })
    return svgElement('g', { 'data-portal-kind': portal.kind }, svgElement('title', {}, escapeXml(`${portal.isSecret ? 'Concealed access: ' : ''}${label}`)) + arrow
      + (options.includeLabels !== false ? svgElement('text', {
          x, y, fill: '#f5eddc', stroke: '#302c27', 'stroke-width': 3, 'paint-order': 'stroke', 'stroke-linejoin': 'round',
          'font-family': 'sans-serif', 'font-size': fontSize, 'font-weight': 600,
          'text-anchor': horizontal && end.x > 0 ? 'end' : 'start',
        }, escapeXml(label)) : ''))
  }).join('')))

  const stairLocations = new Map<string, { kind: 'STAIRS' | 'LADDER'; x: number; y: number; width: number; height: number; destinations: Array<{ up: boolean; floor: number; floorLabel?: string; label: string }> }>()
  for (const stair of visible.stairs ?? []) {
    const fromFloor = roomById.get(stair.fromRoomId)?.floor ?? 0
    const toFloor = roomById.get(stair.toRoomId)?.floor ?? 0
    const up = floor === fromFloor
    const targetFloor = (up ? toFloor : fromFloor) + 1
    const floorLabel = map.floorLabels?.[targetFloor - 1]
    const label = `${up ? 'Up' : 'Down'} to ${floorLabel || `floor ${targetFloor}`}`
    const kind = stair.kind ?? 'STAIRS'
    const key = `${kind}:${stair.x},${stair.y}:${stair.width ?? 1},${stair.height ?? 1}`
    const location = stairLocations.get(key) ?? { kind, x: stair.x, y: stair.y, width: stair.width ?? 1, height: stair.height ?? 1, destinations: [] }
    location.destinations.push({ up, floor: targetFloor, floorLabel, label })
    stairLocations.set(key, location)
  }
  layers.push(svgElement('g', { 'data-layer': 'stairs' }, [...stairLocations.values()].map(stair => {
    const attributes = {
      'data-stair-location': `${stair.x},${stair.y}`, 'data-stair-width': stair.width, 'data-stair-height': stair.height,
      'data-stair-kind': stair.kind, transform: `translate(${stair.x * cell} ${stair.y * cell})`,
    }
    const title = svgElement('title', {}, escapeXml(`${stair.kind === 'LADDER' ? 'Ladder: ' : ''}${stair.destinations.map(destination => destination.label).join('; ')}`))
    if (stair.kind === 'LADDER') {
      const ladder = renderLadder(cell)
      const labels = options.includeLabels === false ? '' : stair.destinations.map(({ label }, index) => svgElement('text', {
        x: cell / 2, y: cell * (1.4 + index * 0.4), fill: '#302a1f', 'font-size': Math.max(10, cell * 0.3),
        'text-anchor': 'middle', 'paint-order': 'stroke', stroke: surface, 'stroke-width': 3,
      }, escapeXml(label))).join('')
      return svgElement('g', attributes, title + ladder + labels)
    }
    const horizontal = stair.width > stair.height
    const breadth = Math.min(stair.width, stair.height) * cell
    const length = Math.max(stair.width, stair.height) * cell
    const { content, hasLandings, landing } = renderStairFlight(cell, breadth, length, wallColor, stair.destinations.map(destination => destination.up))
    const directionColor = STAIR_DIRECTION_COLOR
    const flight = svgElement('g', { transform: horizontal ? `translate(0 ${breadth}) rotate(-90)` : 'translate(0 0)' }, content)
    const text = options.includeLabels === false ? '' : hasLandings
      ? [true, false].map(up => {
          const destination = stair.destinations.find(item => item.up === up)
          const centerX = horizontal ? up ? landing / 2 : length - landing / 2 : breadth / 2
          const centerY = horizontal ? breadth / 2 : up ? landing / 2 : length - landing / 2
          const fontSize = Math.min(12, cell * (horizontal ? 0.3 : 0.34))
          return destination
            ? svgElement('text', { x: centerX, y: centerY - fontSize * 0.12, fill: directionColor, 'font-size': fontSize, 'text-anchor': 'middle' },
                svgElement('tspan', { x: centerX }, `${up ? 'Up' : 'Down'}${horizontal || destination.floorLabel ? '' : ' to'}`)
                + svgElement('tspan', { x: centerX, dy: fontSize * 1.05 }, destination.floorLabel ? '' : horizontal ? `F${destination.floor}` : `floor ${destination.floor}`))
            : svgElement('text', { x: centerX, y: centerY, fill: directionColor, 'font-size': fontSize, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, horizontal ? 'Land.' : 'Landing')
        }).join('')
      : stair.destinations.map(({ label }, index) => svgElement('text', {
          x: stair.width * cell / 2, y: stair.height * cell + cell * (0.4 + index * 0.4), fill: directionColor,
          'font-size': Math.max(10, cell * 0.3), 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: surface, 'stroke-width': 3,
        }, escapeXml(label))).join('')
    const namedDestinations = options.includeLabels === false || !hasLandings ? '' : stair.destinations.filter(destination => destination.floorLabel).map(({ label }, index) => svgElement('text', {
      x: stair.width * cell / 2, y: stair.height * cell + cell * (0.4 + index * 0.4), fill: directionColor,
      'font-size': Math.max(10, cell * 0.3), 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: surface, 'stroke-width': 3,
    }, escapeXml(label))).join('')
    return svgElement('g', attributes, title + flight + text + namedDestinations)
  }).join('')))

  if (options.includeLabels !== false) {
    layers.push(svgElement('g', { 'data-layer': 'labels', fill: '#302a1f', 'font-family': 'sans-serif', 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: surface, 'stroke-width': 3, 'stroke-linejoin': 'round' }, visible.rooms.map(room => {
      const label = room.label ? `${room.roomNumber} · ${room.label}` : `Room ${room.roomNumber}`
      const roomStairs = visible.stairs?.filter(stair => stair.fromRoomId === room.id || stair.toRoomId === room.id) ?? []
      const availableWidth = (room.width - 0.4) * cell
      const labelHeight = roomStairs.length ? Math.max(0.5, Math.min(...roomStairs.map(stair => stair.y - room.y))) * cell : (room.height - 0.5) * cell
      const centerY = roomStairs.length ? room.y * cell + labelHeight / 2 : (room.y + room.height / 2) * cell
      const wrap = (size: number) => {
        const characters = Math.max(1, Math.floor(availableWidth / (size * 0.62)))
        const lines: string[] = []
        for (const word of label.split(/\s+/)) {
          if (lines.length && `${lines.at(-1)} ${word}`.length <= characters) lines[lines.length - 1] += ` ${word}`
          else for (let offset = 0; offset < word.length; offset += characters) lines.push(word.slice(offset, offset + characters))
        }
        return lines
      }
      const longestWord = Math.max(...label.split(/\s+/).map(word => word.length))
      let fontSize = Math.max(8, Math.min(16, cell * 0.45, availableWidth / (longestWord * 0.62)))
      let lines = wrap(fontSize)
      while (fontSize > 8 && lines.length * fontSize * 1.15 > labelHeight - 3) {
        fontSize -= 0.5
        lines = wrap(fontSize)
      }
      const x = (room.x + room.width / 2) * cell
      const top = centerY - (lines.length - 1) * fontSize * 1.15 / 2
      return svgElement('text', { x, 'font-size': fontSize, 'dominant-baseline': 'middle' }, lines.map((line, index) =>
        svgElement('tspan', { x, y: top + index * fontSize * 1.15 }, escapeXml(line))).join(''))
    }).join('')))

    if (sightBlockers.length && options.includeKey !== false) {
      const keyWidth = cell * 4.3
      const keyHeight = cell * 0.8
      const margin = cell * 0.2
      const scale = Math.min(1, (width - margin * 2) / keyWidth, (height - margin * 2) / keyHeight)
      const displayWidth = keyWidth * scale
      const displayHeight = keyHeight * scale
      const occupied = [...visible.rooms, ...(visible.terrain ?? [])].map(item => ({ x: item.x * cell, y: item.y * cell, width: item.width * cell, height: item.height * cell }))
      occupied.push(...portalLabelBounds)
      for (const passage of [...passages, ...portals]) {
        for (let index = 1; index < passage.points.length; index += 1) {
          const from = passage.points[index - 1]!
          const to = passage.points[index]!
          occupied.push({ x: Math.min(from.x, to.x) * cell, y: Math.min(from.y, to.y) * cell, width: (Math.abs(to.x - from.x) + 1) * cell, height: (Math.abs(to.y - from.y) + 1) * cell })
        }
      }
      const candidates = []
      for (const y of [margin, height - displayHeight - margin]) {
        for (let x = margin; x <= Math.max(margin, width - displayWidth - margin); x += cell) {
          const overlaps = occupied.filter(item => x < item.x + item.width && x + displayWidth > item.x && y < item.y + item.height && y + displayHeight > item.y).length
          candidates.push({ x, y, overlaps })
        }
      }
      const position = candidates.sort((a, b) => a.overlaps - b.overlaps)[0]!
      layers.push(svgElement('g', { 'data-layer': 'terrain-key', transform: `translate(${position.x} ${position.y}) scale(${scale})` },
        svgElement('rect', { width: keyWidth, height: keyHeight, rx: 4, fill: '#eee3c5', stroke: '#514936', 'stroke-width': 1 })
        + sightMarker(cell, cell * 0.45, keyHeight / 2)
        + svgElement('text', { x: cell * 0.85, y: keyHeight / 2, 'dominant-baseline': 'middle', 'font-family': 'sans-serif', 'font-size': Math.min(12, cell * 0.36), fill: '#302a1f' }, 'Blocks sight')))
    }
  }

  return svgElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width, height, viewBox: `0 0 ${width} ${height}` }, layers.join('\n'))
}

export type EncounterMapLegendItem = { key: string; label: string; viewBox: string; content: string }
export type EncounterMapLegendSection = { title: string; items: EncounterMapLegendItem[] }

const terrainLegend: Array<{ variant: EncounterMapTerrainVariant; label: string; sample: Pick<EncounterMapTerrainFeature, 'kind' | 'label' | 'elevationFeet'> }> = [
  { variant: 'crate', label: 'Cover', sample: { kind: 'COVER', label: 'Crates' } },
  { variant: 'pillar', label: 'Pillar', sample: { kind: 'COVER', label: 'Pillar' } },
  { variant: 'rock', label: 'Rock', sample: { kind: 'ROCK' } },
  { variant: 'tree', label: 'Tree', sample: { kind: 'TREE' } },
  { variant: 'brush', label: 'Brush', sample: { kind: 'BRUSH' } },
  { variant: 'elevation', label: 'High ground', sample: { kind: 'ELEVATION', elevationFeet: 5 } },
  { variant: 'difficult', label: 'Difficult terrain', sample: { kind: 'DIFFICULT' } },
  { variant: 'hazard', label: 'Hazard', sample: { kind: 'HAZARD' } },
]

/**
 * Legend swatches for one floor, drawn with the same symbols as the map. Only
 * features present on that floor are listed, so the legend matches the view.
 */
export const renderEncounterMapLegend = (map: EncounterMapData, options: Pick<RenderOptions, 'floor' | 'includeFlow'> = {}): EncounterMapLegendSection[] => {
  const cell = 32
  const visible = getEncounterMapFloorMap(map, options.floor ?? 0)
  const forest = map.mapType === 'FOREST'
  const { surface, wall } = encounterMapPalette(map.mapType)
  const floorTile = (size = cell) => svgElement('rect', { x: 0, y: 0, width: size, height: size, fill: surface })
  const item = (key: string, label: string, content: string, viewBox = `0 0 ${cell} ${cell}`): EncounterMapLegendItem => ({ key, label, viewBox, content })
  const portals = visible.portals ?? []
  const stairKinds = new Set((visible.stairs ?? []).map(stair => stair.kind ?? 'STAIRS'))
  const variants = new Set((visible.terrain ?? []).map(terrain => encounterMapTerrainVariant(terrain, forest)))
  const portalArrow = (portal: { kind: 'ENTRANCE' | 'EXIT'; isSecret?: boolean }) => floorTile()
    + svgElement('path', { transform: `translate(${cell / 2} ${cell / 2}) rotate(-90)`, d: arrowPath(cell), stroke: portalColor(portal), 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  const passageWidth = cell * (forest ? 1.3 : 0.8)

  const layout = [
    item('room', forest ? 'Clearing' : 'Room', forest
      ? svgElement('path', { transform: `scale(${cell})`, d: CLEARING_PATH, fill: surface })
      : svgElement('rect', { x: 3, y: 3, width: cell - 6, height: cell - 6, fill: surface, stroke: wall, 'stroke-width': 5 })),
    ...(visible.corridors.length || portals.length ? [item('passage', forest ? 'Trail' : 'Passage',
      (forest ? '' : svgElement('line', { x1: 0, y1: cell * 0.75, x2: cell * 1.5, y2: cell * 0.75, stroke: wall, 'stroke-width': passageWidth + 5 }))
      + svgElement('line', { x1: 0, y1: cell * 0.75, x2: cell * 1.5, y2: cell * 0.75, stroke: surface, 'stroke-width': passageWidth, 'stroke-linecap': forest ? 'round' : 'butt' }),
      `0 0 ${cell * 1.5} ${cell * 1.5}`)] : []),
    ...(visible.rooms.some(room => room.isSecret) ? [item('secret-room', 'Secret room',
      svgElement('rect', { x: 3, y: 3, width: cell - 6, height: cell - 6, fill: surface, stroke: SECRET_ROOM_STROKE, 'stroke-width': 5, 'stroke-dasharray': '6 3' }))] : []),
    ...(visible.rooms.some(room => room.kind === 'BALCONY') ? [item('balcony', 'Balcony', renderBalcony(cell, 0, 0, 1, 1), `-4 -4 ${cell + 8} ${cell + 8}`)] : []),
    ...(visible.corridors.some(passage => passage.kind === 'BRIDGE') ? [item('bridge', 'Bridge',
      svgElement('rect', { x: 0, y: 0, width: cell, height: cell, fill: forest ? '#496b74' : '#181c20' })
      + svgElement('g', { transform: `translate(${cell / 2} ${cell / 2})` }, renderBridgeTile(cell)))] : []),
  ]

  const doorKinds = [
    { key: 'door', label: 'Door', door: { isSecret: false, isLocked: false } },
    { key: 'locked-door', label: 'Locked door', door: { isSecret: false, isLocked: true } },
    { key: 'secret-door', label: 'Secret door', door: { isSecret: true, isLocked: false } },
  ].filter(({ door }) => visible.doors.some(item => item.isSecret === door.isSecret && (door.isSecret || item.isLocked === door.isLocked)))
  const access = [
    ...doorKinds.map(({ key, label, door }) => item(key, label,
      svgElement('rect', { x: -cell / 2, y: -cell / 2, width: cell, height: cell, fill: surface }) + renderEncounterMapDoorSymbol(cell, door), `${-cell / 2} ${-cell / 2} ${cell} ${cell}`)),
    ...(portals.some(portal => portal.kind === 'ENTRANCE' && !portal.isSecret) ? [item('entrance', 'Entrance', portalArrow({ kind: 'ENTRANCE' }))] : []),
    ...(portals.some(portal => portal.kind === 'EXIT' && !portal.isSecret) ? [item('exit', 'Exit', portalArrow({ kind: 'EXIT' }))] : []),
    ...(portals.some(portal => portal.isSecret) ? [item('concealed', 'Concealed entrance', portalArrow({ kind: 'ENTRANCE', isSecret: true }))] : []),
    ...(stairKinds.has('STAIRS') ? [item('stairs', 'Stairs (arrow points up)', renderStairFlight(cell, cell, cell * 2, wall, [true]).content, `0 0 ${cell} ${cell * 2}`)] : []),
    ...(stairKinds.has('LADDER') ? [item('ladder', 'Ladder', renderLadder(cell))] : []),
  ]

  const terrain = [
    ...terrainLegend.filter(entry => variants.has(entry.variant)).map(entry => item(entry.variant, entry.label,
      floorTile() + renderTerrain({ id: `legend-${entry.variant}`, x: 0, y: 0, width: 1, height: 1, ...entry.sample }, cell, forest, true))),
    ...((visible.terrain ?? []).some(feature => feature.blocksSight) ? [item('blocks-sight', 'Blocks sight', sightMarker(cell, cell / 2, cell / 2, cell * 0.35))] : []),
  ]

  const routeOnFloor = Boolean(options.includeFlow && map.flow && visible.rooms.some(room => map.flow!.routeRoomIds.includes(room.id)))
  const route = routeOnFloor ? [
    item('route', 'Encounter route',
      svgElement('line', { x1: 2, y1: cell / 2, x2: cell * 1.5 - 2, y2: cell / 2, stroke: ROUTE_COLOR, 'stroke-width': 3, 'stroke-dasharray': `${cell * 0.24} ${cell * 0.14}` })
      + svgElement('path', { transform: `translate(${cell * 0.75} ${cell / 2})`, d: arrowPath(cell), stroke: ROUTE_COLOR, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      `0 0 ${cell * 1.5} ${cell}`),
    ...(visible.rooms.some(room => room.id === map.flow!.objectiveRoomId) ? [item('objective', 'Objective',
      floorTile() + svgElement('circle', { cx: cell / 2, cy: cell / 2, r: cell * 0.22, fill: '#dcad49', stroke: '#745120', 'stroke-width': 2 }))] : []),
  ] : []

  return [
    { title: 'Layout', items: layout },
    { title: 'Access', items: access },
    { title: 'Terrain', items: terrain },
    { title: 'Route', items: route },
  ].filter(section => section.items.length)
}
