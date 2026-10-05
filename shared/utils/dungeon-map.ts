import type { DungeonGeneratorConfig, DungeonMapData } from '../types/dungeon'

export const toPlayerSafeDungeonConfig = (config: DungeonGeneratorConfig): DungeonGeneratorConfig => config.accessPoints
  ? { ...config, accessPoints: { ...config.accessPoints, concealedEntrance: false } }
  : config

export const toPlayerSafeMap = (map: DungeonMapData): DungeonMapData => {
  const { flow: _flow, ...visibleMetadata } = map
  const visibleRoomIds = new Set(map.rooms.filter((room) => !room.isSecret).map((room) => room.id))
  const corridors = map.corridors.filter(
    (corridor) => visibleRoomIds.has(corridor.fromRoomId) && visibleRoomIds.has(corridor.toRoomId),
  )
  const corridorIds = new Set(corridors.map((corridor) => corridor.id))
  return {
    ...visibleMetadata,
    rooms: map.rooms.filter((room) => !room.isSecret),
    corridors,
    doors: map.doors.filter((door) => !door.isSecret && corridorIds.has(door.corridorId)),
    traps: map.traps.filter((trap) => visibleRoomIds.has(trap.roomId)),
    encounters: map.encounters.filter((encounter) => visibleRoomIds.has(encounter.roomId)),
    treasures: map.treasures.filter((treasure) => visibleRoomIds.has(treasure.roomId)),
    dressing: map.dressing.filter((dressing) => visibleRoomIds.has(dressing.roomId)),
    zones: map.zones,
    ...(map.stairs ? { stairs: map.stairs.filter(stair => visibleRoomIds.has(stair.fromRoomId) && visibleRoomIds.has(stair.toRoomId)) } : {}),
    ...(map.portals ? { portals: map.portals.filter(portal => !portal.isSecret && visibleRoomIds.has(portal.roomId)) } : {}),
    ...(map.terrain ? { terrain: map.terrain.filter(terrain => !terrain.roomId || visibleRoomIds.has(terrain.roomId)) } : {}),
  }
}
export const getDungeonFloorMap = (map: DungeonMapData, floor = 0): DungeonMapData => {
  // An ordered encounter route belongs to the whole graph, not a truncated floor graph.
  const { flow: _flow, ...floorMetadata } = map
  const rooms = map.rooms.filter(room => (room.floor ?? 0) === floor)
  const roomIds = new Set(rooms.map(room => room.id))
  const corridors = map.corridors.filter(corridor => roomIds.has(corridor.fromRoomId) && roomIds.has(corridor.toRoomId))
  const corridorIds = new Set(corridors.map(corridor => corridor.id))
  return {
    ...floorMetadata,
    rooms,
    corridors,
    doors: map.doors.filter(door => corridorIds.has(door.corridorId)),
    walls: map.walls.filter(wall => (wall.floor ?? 0) === floor),
    zones: map.zones.filter(zone => (zone.floor ?? 0) === floor),
    traps: map.traps.filter(trap => roomIds.has(trap.roomId)),
    encounters: map.encounters.filter(encounter => roomIds.has(encounter.roomId)),
    treasures: map.treasures.filter(treasure => roomIds.has(treasure.roomId)),
    dressing: map.dressing.filter(dressing => roomIds.has(dressing.roomId)),
    terrain: (map.terrain ?? []).filter(terrain =>
      (terrain.floor ?? 0) === floor
      && (!terrain.roomId || roomIds.has(terrain.roomId))),
    stairs: (map.stairs ?? []).filter(stair => roomIds.has(stair.fromRoomId) || roomIds.has(stair.toRoomId)),
    ...(map.portals ? { portals: map.portals.filter(portal => roomIds.has(portal.roomId)) } : {}),
  }
}
