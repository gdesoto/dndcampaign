import type { JsonValue } from '#server/db/columns'
import { z } from 'zod'
import { db } from '#server/db/client'
import { campaignDungeon, campaignDungeonRoom, campaignDungeonLink } from '#server/db/schema'
import { eq, and, notInArray, asc, desc } from 'drizzle-orm'
import {
  dungeonMapSchema,
  type DungeonLinkCreateInput,
  type DungeonMapPatchActionInput,
  type DungeonMapPatchInput,
  type DungeonRoomUpdateInput,
} from '#shared/schemas/dungeon'
import type {
  CampaignDungeonLink,
  CampaignDungeonRoom,
  DungeonMapData,
  DungeonRoomGeometry,
} from '#shared/types/dungeon'
import { routePortalToEdge } from '#server/services/dungeon/encounter-features'
import type { EncounterCreateInput } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'
import { ActivityLogService } from '#server/services/activity-log.service'
import { apiError } from '#server/utils/http'
import type { CampaignActor } from '#server/utils/campaign-auth'

const toRoomDto = (row: {
  id: string
  dungeonId: string
  roomNumber: number
  name: string
  description: string | null
  gmNotes: string | null
  playerNotes: string | null
  readAloud: string | null
  tagsJson: unknown
  boundsJson: unknown
  state: 'UNSEEN' | 'EXPLORED' | 'CLEARED' | 'CONTESTED'
  createdAt: Date
  updatedAt: Date
}): CampaignDungeonRoom => {
  const tags = z.array(z.string()).safeParse(row.tagsJson)
  const bounds = z
    .object({
      x: z.number().int(),
      y: z.number().int(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      floor: z.number().int().nonnegative().optional(),
    })
    .nullable()
    .safeParse(row.boundsJson)

  return {
    id: row.id,
    dungeonId: row.dungeonId,
    roomNumber: row.roomNumber,
    name: row.name,
    description: row.description,
    gmNotes: row.gmNotes,
    playerNotes: row.playerNotes,
    readAloud: row.readAloud,
    tags: tags.success ? tags.data : [],
    bounds: bounds.success ? bounds.data : null,
    state: row.state,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const toLinkDto = (row: {
  id: string
  dungeonId: string
  roomId: string | null
  linkType: 'SESSION' | 'QUEST' | 'MILESTONE' | 'GLOSSARY' | 'ENCOUNTER'
  targetId: string
  createdAt: Date
}): CampaignDungeonLink => ({
  id: row.id,
  dungeonId: row.dungeonId,
  roomId: row.roomId,
  linkType: row.linkType,
  targetId: row.targetId,
  createdAt: row.createdAt.toISOString(),
})

const withDungeonAccess = async (campaignId: string, dungeonId: string) =>
  db.query.campaignDungeon.findFirst({ where: and(eq(campaignDungeon.id, dungeonId), eq(campaignDungeon.campaignId, campaignId)), columns: {
      id: true,
      mapJson: true,
    } }).sync()

const syncRoomRowsToMap = async (dungeonId: string, previousRooms: DungeonRoomGeometry[], map: DungeonMapData) => {
  db.transaction((tx) => {
    const existing = tx.query.campaignDungeonRoom.findMany({ where: eq(campaignDungeonRoom.dungeonId, dungeonId) }).sync()
    const byNumber = new Map(existing.map(room => [room.roomNumber, room]))
    // Geometry ids survive movement and renumbering; database ids preserve notes and links.
    const byGeometryId = new Map(previousRooms.map(room => [room.id, byNumber.get(room.roomNumber)]))
    const retainedIds = map.rooms.flatMap(room => {
      const current = byGeometryId.get(room.id)
      return current ? [current.id] : []
    })
    tx.delete(campaignDungeonRoom).where(and(eq(campaignDungeonRoom.dungeonId, dungeonId), notInArray(campaignDungeonRoom.id, retainedIds))).run()
    // Vacate unique room numbers before applying a permutation.
    for (const [index, id] of retainedIds.entries()) {
      tx.update(campaignDungeonRoom).set({ roomNumber: -index - 1 }).where(eq(campaignDungeonRoom.id, id)).returning().get()!
    }
    for (const room of map.rooms) {
      const current = byGeometryId.get(room.id)
      const data = {
        roomNumber: room.roomNumber,
        boundsJson: { x: room.x, y: room.y, width: room.width, height: room.height, floor: room.floor ?? 0 },
      }
      if (current) {
        tx.update(campaignDungeonRoom).set(data).where(eq(campaignDungeonRoom.id, current.id)).returning().get()!
      } else {
        tx.insert(campaignDungeonRoom).values({ ...data, dungeonId, name: room.label || `Room ${room.roomNumber}`, tagsJson: [] }).returning().get()!
      }
    }
    tx.update(campaignDungeon).set({ mapJson: (map) as unknown as JsonValue }).where(eq(campaignDungeon.id, dungeonId)).returning().get()!
  }, { behavior: 'immediate' })
}

const makeRoomId = () => `room-${Math.random().toString(36).slice(2, 10)}`
const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`
const activityLogService = new ActivityLogService()

const normalizeRoomNumbers = (rooms: DungeonMapData['rooms']) =>
  [...rooms]
    .sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0) || a.y - b.y || a.x - b.x)
    .map((room, index) => ({ ...room, roomNumber: index + 1 }))

const reanchorRoomPortals = (map: DungeonMapData, previous: DungeonRoomGeometry, bounds: DungeonRoomGeometry) => {
  if (!map.portals) return
  const staged = { ...map, rooms: map.rooms.map(room => room.id === previous.id ? bounds : room), portals: [...map.portals] }
  for (const [index, portal] of staged.portals.entries()) {
    if (portal.roomId !== previous.id) continue
    const end = portal.points.at(-1)!
    const beforeEnd = portal.points.at(-2)!
    const horizontal = end.x !== beforeEnd.x || (end.y === beforeEnd.y && (end.x === 0 || end.x === map.width - 1))
    const side = horizontal ? end.x === 0 ? 'WEST' : 'EAST' : end.y === 0 ? 'NORTH' : 'SOUTH'
    const points = routePortalToEdge(staged, previous.id, side, portal.id)
    if (!points) throw apiError(400, 'VALIDATION_ERROR', 'This edit would block an entrance or exit. Keep a clear route from the room to the map edge.')
    staged.portals[index] = { ...portal, points }
  }
  map.portals = staged.portals
}

const applyMapAction = (map: DungeonMapData, action: DungeonMapPatchActionInput): DungeonMapData => {
  if ('floor' in action && (action.floor ?? 0) >= (map.floorCount ?? 1)) {
    throw apiError(400, 'VALIDATION_ERROR', 'This floor does not exist on the map.')
  }
  if (action.type === 'REMOVE_ROOM' && map.stairs?.some(stair => stair.fromRoomId === action.roomId || stair.toRoomId === action.roomId)) {
    throw apiError(400, 'VALIDATION_ERROR', 'Stairs or a ladder connect this room to another floor. Generate a new layout to change these connections.')
  }
  if (action.type === 'MOVE_ROOM' || action.type === 'RESIZE_ROOM') {
    const room = map.rooms.find(room => room.id === action.roomId)
    if (room) {
      const bounds = action.type === 'MOVE_ROOM'
        ? { ...room, x: action.x, y: action.y }
        : { ...room, width: action.width, height: action.height }
      const losesLanding = map.stairs?.some(stair =>
        (stair.fromRoomId === room.id || stair.toRoomId === room.id)
        && (stair.x < bounds.x || stair.x + (stair.width ?? 1) > bounds.x + bounds.width
          || stair.y < bounds.y || stair.y + (stair.height ?? 1) > bounds.y + bounds.height))
      if (losesLanding) {
        throw apiError(400, 'VALIDATION_ERROR', 'Keep the entire stair or ladder footprint inside this room so the floors remain connected.')
      }
    }
  }
  const next: DungeonMapData = {
    ...map,
    rooms: [...map.rooms],
    corridors: [...map.corridors],
    doors: [...map.doors],
    walls: [...map.walls],
    zones: [...map.zones],
    metadata: {
      ...map.metadata,
      generatedAt: new Date().toISOString(),
    },
  }

  // A generated route describes a particular layout. Manual geometry changes
  // retain exterior openings, but no longer claim the original encounter plan.
  if (['ADD_ROOM', 'MOVE_ROOM', 'RESIZE_ROOM', 'REMOVE_ROOM', 'ADD_CORRIDOR', 'REMOVE_CORRIDOR', 'DRAW_WALL_SEGMENT', 'ERASE_WALL_SEGMENT'].includes(action.type)) {
    delete next.flow
  }

  if (action.type === 'ADD_ROOM') {
    const nextRoomNumber = action.roomNumber || (next.rooms.at(-1)?.roomNumber || 0) + 1
    next.rooms.push({
      id: makeRoomId(),
      roomNumber: nextRoomNumber,
      x: action.x,
      y: action.y,
      width: action.width,
      height: action.height,
      isSecret: action.isSecret,
      floor: action.floor ?? 0,
    })
    next.rooms.sort((a, b) => a.roomNumber - b.roomNumber)
    return next
  }

  if (action.type === 'REMOVE_ROOM') {
    next.rooms = next.rooms.filter((room) => room.id !== action.roomId)
    next.corridors = next.corridors.filter(
      (corridor) => corridor.fromRoomId !== action.roomId && corridor.toRoomId !== action.roomId,
    )
    const validCorridorIds = new Set(next.corridors.map((corridor) => corridor.id))
    next.doors = next.doors.filter((door) => validCorridorIds.has(door.corridorId))
    next.traps = next.traps.filter((trap) => trap.roomId !== action.roomId)
    next.encounters = next.encounters.filter((encounter) => encounter.roomId !== action.roomId)
    next.treasures = next.treasures.filter((treasure) => treasure.roomId !== action.roomId)
    next.dressing = next.dressing.filter((dressing) => dressing.roomId !== action.roomId)
    if (next.terrain) next.terrain = next.terrain.filter(feature => feature.roomId !== action.roomId)
    if (next.portals) next.portals = next.portals.filter(portal => portal.roomId !== action.roomId)
    return next
  }

  if (action.type === 'MOVE_ROOM') {
    const room = next.rooms.find(room => room.id === action.roomId)
    if (room) {
      if (next.terrain) next.terrain = next.terrain.map(feature => feature.roomId === room.id
        ? { ...feature, x: feature.x + action.x - room.x, y: feature.y + action.y - room.y }
        : feature)
      reanchorRoomPortals(next, room, { ...room, x: action.x, y: action.y })
    }
    next.rooms = next.rooms.map((room) =>
      room.id === action.roomId
        ? {
            ...room,
            x: action.x,
            y: action.y,
          }
        : room,
    )
    return next
  }

  if (action.type === 'RESIZE_ROOM') {
    const room = next.rooms.find(room => room.id === action.roomId)
    if (room) reanchorRoomPortals(next, room, { ...room, width: action.width, height: action.height })
    next.rooms = next.rooms.map((room) =>
      room.id === action.roomId
        ? {
            ...room,
            width: action.width,
            height: action.height,
          }
        : room,
    )
    return next
  }

  if (action.type === 'ADD_CORRIDOR') {
    const from = next.rooms.find((room) => room.id === action.fromRoomId)
    const to = next.rooms.find((room) => room.id === action.toRoomId)
    if (!from || !to) return next
    if ((from.floor ?? 0) !== (to.floor ?? 0)) {
      throw apiError(400, 'VALIDATION_ERROR', 'Corridors must connect rooms on the same floor. Stairs connect different floors.')
    }
    next.corridors.push({
      id: makeId('corridor'),
      fromRoomId: action.fromRoomId,
      toRoomId: action.toRoomId,
      points: action.points,
    })
    return next
  }

  if (action.type === 'REMOVE_CORRIDOR') {
    next.corridors = next.corridors.filter((corridor) => corridor.id !== action.corridorId)
    next.doors = next.doors.filter((door) => door.corridorId !== action.corridorId)
    return next
  }

  if (action.type === 'ADD_DOOR') {
    if (!next.corridors.some((corridor) => corridor.id === action.corridorId)) return next
    next.doors.push({
      id: makeId('door'),
      corridorId: action.corridorId,
      x: action.x,
      y: action.y,
      isLocked: action.isLocked,
      isSecret: action.isSecret,
      isSpecial: action.isSpecial,
    })
    return next
  }

  if (action.type === 'MOVE_DOOR') {
    next.doors = next.doors.map((door) =>
      door.id === action.doorId
        ? {
            ...door,
            x: action.x,
            y: action.y,
          }
        : door,
    )
    return next
  }

  if (action.type === 'REMOVE_DOOR') {
    next.doors = next.doors.filter((door) => door.id !== action.doorId)
    return next
  }

  if (action.type === 'TOGGLE_DOOR_SECRET') {
    next.doors = next.doors.map((door) =>
      door.id === action.doorId
        ? {
            ...door,
            isSecret: !door.isSecret,
          }
        : door,
    )
    return next
  }

  if (action.type === 'TOGGLE_DOOR_LOCK') {
    next.doors = next.doors.map((door) =>
      door.id === action.doorId
        ? {
            ...door,
            isLocked: !door.isLocked,
          }
        : door,
    )
    return next
  }

  if (action.type === 'DRAW_WALL_SEGMENT') {
    next.walls.push({
      id: makeId('wall'),
      x1: action.x1,
      y1: action.y1,
      x2: action.x2,
      y2: action.y2,
      floor: action.floor ?? 0,
    })
    return next
  }

  if (action.type === 'ERASE_WALL_SEGMENT') {
    next.walls = next.walls.filter((wall) => wall.id !== action.wallId)
    return next
  }

  if (action.type === 'RENUMBER_ROOMS') {
    if (action.mode === 'EXPLICIT' && action.roomOrder?.length) {
      const byId = new Map(next.rooms.map((room) => [room.id, room]))
      let nextNumber = 1
      const explicit = action.roomOrder
        .map((id) => byId.get(id))
        .filter((room): room is NonNullable<typeof room> => Boolean(room))
        .map((room) => ({ ...room, roomNumber: nextNumber++ }))
      const explicitIds = new Set(explicit.map((room) => room.id))
      const rest = next.rooms
        .filter((room) => !explicitIds.has(room.id))
        .sort((a, b) => (a.roomNumber === b.roomNumber ? a.id.localeCompare(b.id) : a.roomNumber - b.roomNumber))
        .map((room) => ({ ...room, roomNumber: nextNumber++ }))
      next.rooms = [...explicit, ...rest]
      return next
    }
    next.rooms = normalizeRoomNumbers(next.rooms)
    return next
  }

  if (action.type === 'PAINT_ZONE') {
    next.zones.push({
      id: makeId('zone'),
      type: action.zoneType,
      label: action.label,
      cells: action.cells,
      floor: action.floor ?? 0,
    })
    return next
  }

  if (action.type === 'CLEAR_ZONE') {
    next.zones = next.zones.filter((zone) => zone.id !== action.zoneId)
    return next
  }

  if (action.type === 'TOGGLE_LOCK') {
    if (action.entityType === 'DOOR') {
      next.doors = next.doors.map((door) =>
        door.id === action.entityId
          ? {
              ...door,
              isLocked: !door.isLocked,
            }
          : door,
      )
    }
    if (action.entityType === 'TRAP') {
      next.traps = next.traps.map((trap) =>
        trap.id === action.entityId
          ? {
              ...trap,
              isLocked: !trap.isLocked,
            }
          : trap,
      )
    }
    if (action.entityType === 'ENCOUNTER') {
      next.encounters = next.encounters.map((encounter) =>
        encounter.id === action.entityId
          ? {
              ...encounter,
              isLocked: !encounter.isLocked,
            }
          : encounter,
      )
    }
    if (action.entityType === 'TREASURE') {
      next.treasures = next.treasures.map((treasure) =>
        treasure.id === action.entityId
          ? {
              ...treasure,
              isLocked: !treasure.isLocked,
            }
          : treasure,
      )
    }
    if (action.entityType === 'DRESSING') {
      next.dressing = next.dressing.map((dressing) =>
        dressing.id === action.entityId
          ? {
              ...dressing,
              isLocked: !dressing.isLocked,
            }
          : dressing,
      )
    }
    return next
  }

  return next
}

export class DungeonEditorService {
  async listRooms(
    campaignId: string,
    dungeonId: string,
    actor: CampaignActor,
  ): Promise<CampaignDungeonRoom[]> {
    const access = await withDungeonAccess(campaignId, dungeonId)
    if (!access) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const rows = db.query.campaignDungeonRoom.findMany({ where: eq(campaignDungeonRoom.dungeonId, access.id), orderBy: [asc(campaignDungeonRoom.roomNumber)] }).sync()
    const isViewer = actor.access.role === 'VIEWER'
    const visibleNumbers = isViewer
      ? new Set(dungeonMapSchema.parse(access.mapJson).rooms.filter(room => !room.isSecret).map(room => room.roomNumber))
      : null
    return rows.filter(row => !visibleNumbers || visibleNumbers.has(row.roomNumber)).map((row) => {
        const dto = toRoomDto(row)
        return isViewer ? { ...dto, gmNotes: null } : dto
      })
  }

  async updateRoom(
    campaignId: string,
    dungeonId: string,
    roomId: string,
    actor: CampaignActor,
    input: DungeonRoomUpdateInput,
  ): Promise<CampaignDungeonRoom> {
    const access = await withDungeonAccess(campaignId, dungeonId)
    if (!access) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const existing = db.query.campaignDungeonRoom.findFirst({ where: and(eq(campaignDungeonRoom.id, roomId), eq(campaignDungeonRoom.dungeonId, access.id)), columns: { id: true } }).sync()
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Room not found.')
    }

    const updated = db.update(campaignDungeonRoom).set({
        ...(input.name ? { name: input.name } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'description') ? { description: input.description ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'gmNotes') ? { gmNotes: input.gmNotes ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'playerNotes') ? { playerNotes: input.playerNotes ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'readAloud') ? { readAloud: input.readAloud ?? null } : {}),
        ...(input.tags ? { tagsJson: input.tags } : {}),
        ...(input.state ? { state: input.state } : {}),
      }).where(eq(campaignDungeonRoom.id, roomId)).returning().get()!

    return toRoomDto(updated)
  }

  async patchMap(
    campaignId: string,
    dungeonId: string,
    actor: CampaignActor,
    input: DungeonMapPatchInput,
  ): Promise<DungeonMapData> {
    const userId = actor.userId
    const access = await withDungeonAccess(campaignId, dungeonId)
    if (!access) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const previousMap = dungeonMapSchema.parse(access.mapJson)
    let map = previousMap
    for (const action of input.actions) {
      map = applyMapAction(map, action)
    }

    const validated = dungeonMapSchema.safeParse(map)
    if (!validated.success) {
      throw apiError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || 'These edits would leave invalid map geometry.')
    }
    map = validated.data

    await syncRoomRowsToMap(access.id, previousMap.rooms, map)
    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_MAP_PATCHED',
      targetType: 'DUNGEON',
      targetId: dungeonId,
      summary: `Patched dungeon map with ${input.actions.length} action(s).`,
    })

    return map
  }

  async createEncounterFromRoom(
    campaignId: string,
    dungeonId: string,
    roomId: string,
    actor: CampaignActor,
  ): Promise<{ encounterId: string }> {
    const userId = actor.userId
    const access = await withDungeonAccess(campaignId, dungeonId)
    if (!access) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const room = db.query.campaignDungeonRoom.findFirst({ where: and(eq(campaignDungeonRoom.dungeonId, access.id), eq(campaignDungeonRoom.id, roomId)) }).sync()
    if (!room) {
      throw apiError(404, 'NOT_FOUND', 'Room not found.')
    }

    const encounter: EncounterCreateInput = {
      name: `${room.name} Encounter`,
      type: 'COMBAT',
      visibility: 'SHARED',
      notes: `Created from dungeon room ${room.roomNumber}.`,
      sessionId: undefined,
      calendarYear: undefined,
      calendarMonth: undefined,
      calendarDay: undefined,
    }
    const created = await new EncounterService().createEncounter(campaignId, userId, encounter)

    db.insert(campaignDungeonLink).values({
        dungeonId: access.id,
        roomId,
        linkType: 'ENCOUNTER',
        targetId: created.id,
      }).returning().get()!
    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_ROOM_ENCOUNTER_CREATED',
      targetType: 'DUNGEON',
      targetId: dungeonId,
      summary: `Created encounter from room ${room.roomNumber}.`,
      metadata: {
        roomId,
        encounterId: created.id,
      },
    })

    return { encounterId: created.id }
  }

  async listLinks(campaignId: string, dungeonId: string): Promise<CampaignDungeonLink[]> {
    const access = await withDungeonAccess(campaignId, dungeonId)
    if (!access) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const rows = db.query.campaignDungeonLink.findMany({ where: eq(campaignDungeonLink.dungeonId, access.id), orderBy: [desc(campaignDungeonLink.createdAt)] }).sync()
    return rows.map(toLinkDto)
  }

  async createLink(
    campaignId: string,
    dungeonId: string,
    actor: CampaignActor,
    input: DungeonLinkCreateInput,
  ): Promise<CampaignDungeonLink> {
    const access = await withDungeonAccess(campaignId, dungeonId)
    if (!access) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    if (input.roomId) {
      const room = db.query.campaignDungeonRoom.findFirst({ where: and(eq(campaignDungeonRoom.id, input.roomId), eq(campaignDungeonRoom.dungeonId, access.id)), columns: { id: true } }).sync()
      if (!room) {
        throw apiError(400, 'VALIDATION_ERROR', 'Room id is invalid for this dungeon.', { roomId: 'Room not found in this dungeon.' })
      }
    }

    const created = db.insert(campaignDungeonLink).values({
        dungeonId: access.id,
        roomId: input.roomId || null,
        linkType: input.linkType,
        targetId: input.targetId,
      }).returning().get()!
    return toLinkDto(created)
  }

  async deleteLink(
    campaignId: string,
    dungeonId: string,
    linkId: string,
  ): Promise<{ deleted: true }> {
    const access = await withDungeonAccess(campaignId, dungeonId)
    if (!access) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const existing = db.query.campaignDungeonLink.findFirst({ where: and(eq(campaignDungeonLink.id, linkId), eq(campaignDungeonLink.dungeonId, access.id)), columns: { id: true } }).sync()
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon link not found.')
    }

    db.delete(campaignDungeonLink).where(eq(campaignDungeonLink.id, linkId)).returning().get()!

    return { deleted: true }
  }
}
