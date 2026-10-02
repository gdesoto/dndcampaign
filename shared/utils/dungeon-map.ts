import type { DungeonMapData } from '../types/dungeon'

export const toPlayerSafeMap = (map: DungeonMapData): DungeonMapData => {
  const visibleRoomIds = new Set(map.rooms.filter((room) => !room.isSecret).map((room) => room.id))
  const corridors = map.corridors.filter(
    (corridor) => visibleRoomIds.has(corridor.fromRoomId) && visibleRoomIds.has(corridor.toRoomId),
  )
  const corridorIds = new Set(corridors.map((corridor) => corridor.id))
  return {
    ...map,
    rooms: map.rooms.filter((room) => !room.isSecret),
    corridors,
    doors: map.doors.filter((door) => !door.isSecret && corridorIds.has(door.corridorId)),
    traps: map.traps.filter((trap) => visibleRoomIds.has(trap.roomId)),
    encounters: map.encounters.filter((encounter) => visibleRoomIds.has(encounter.roomId)),
    treasures: map.treasures.filter((treasure) => visibleRoomIds.has(treasure.roomId)),
    dressing: map.dressing.filter((dressing) => visibleRoomIds.has(dressing.roomId)),
    zones: map.zones,
  }
}
