import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import type { EncounterMapData } from '#shared/types/encounter-map'
import { getEncounterMapFloorMap } from '#shared/utils/encounter-map'

export type EncounterMapMarkerKind = 'door' | 'trap' | 'encounter' | 'treasure'
export type EncounterMapMarkerSelection = { kind: EncounterMapMarkerKind; id: string }

/**
 * MapLibre places the grid near the equator, where one map spans one degree and
 * Web Mercator distortion is negligible. x grows east and y grows south.
 */
const degreesPerCell = (map: Pick<EncounterMapData, 'width' | 'height'>) => 1 / Math.max(map.width, map.height, 1)

export const encounterMapCellToLngLat = (map: Pick<EncounterMapData, 'width' | 'height'>, x: number, y: number): [number, number] => {
  const scale = degreesPerCell(map)
  return [x * scale, -y * scale]
}

export const encounterMapBounds = (map: Pick<EncounterMapData, 'width' | 'height'>) => {
  const [east, south] = encounterMapCellToLngLat(map, map.width, map.height)
  return [[0, south], [east, 0]] as [[number, number], [number, number]]
}

/** Image source corners in MapLibre order: top-left, top-right, bottom-right, bottom-left. */
export const encounterMapImageCoordinates = (map: Pick<EncounterMapData, 'width' | 'height'>) => {
  const [[west, south], [east, north]] = encounterMapBounds(map)
  return [[west, north], [east, north], [east, south], [west, south]] as
    [[number, number], [number, number], [number, number], [number, number]]
}

type RoomProperties = { kind: 'room'; id: string }
type MarkerProperties = { kind: EncounterMapMarkerKind; id: string; roomId?: string }

/** Rooms are hit areas and selection outlines; markers place room contents and door targets. */
export const encounterMapFeatures = (map: EncounterMapData, floor: number): FeatureCollection<Polygon | Point, RoomProperties | MarkerProperties> => {
  const visible = getEncounterMapFloorMap(map, floor)
  const point = (x: number, y: number) => encounterMapCellToLngLat(map, x, y)
  const rooms: Feature<Polygon, RoomProperties>[] = visible.rooms.map(room => ({
    type: 'Feature',
    id: room.id,
    properties: { kind: 'room', id: room.id },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        point(room.x, room.y), point(room.x + room.width, room.y), point(room.x + room.width, room.y + room.height),
        point(room.x, room.y + room.height), point(room.x, room.y),
      ]],
    },
  }))
  const markers: Feature<Point, MarkerProperties>[] = visible.doors.map(door => ({
    type: 'Feature',
    id: door.id,
    properties: { kind: 'door', id: door.id },
    geometry: { type: 'Point', coordinates: point(door.x + 0.5, door.y + 0.5) },
  }))
  for (const room of visible.rooms) {
    // Contents line up along the room's top edge, wrapping inside its width.
    const contents = [
      ...visible.traps.filter(item => item.roomId === room.id).map(item => ({ kind: 'trap' as const, id: item.id })),
      ...visible.encounters.filter(item => item.roomId === room.id).map(item => ({ kind: 'encounter' as const, id: item.id })),
      ...visible.treasures.filter(item => item.roomId === room.id).map(item => ({ kind: 'treasure' as const, id: item.id })),
    ]
    const perRow = Math.max(1, room.width)
    contents.forEach((item, index) => markers.push({
      type: 'Feature',
      id: item.id,
      properties: { ...item, roomId: room.id },
      geometry: {
        type: 'Point',
        coordinates: point(room.x + 0.5 + (index % perRow), room.y + 0.5 + Math.floor(index / perRow)),
      },
    }))
  }
  return { type: 'FeatureCollection', features: [...rooms, ...markers] }
}

export const encounterMapMarkerColors: Record<Exclude<EncounterMapMarkerKind, 'door'>, string> = {
  trap: '#f97316',
  encounter: '#dc2626',
  treasure: '#eab308',
}
