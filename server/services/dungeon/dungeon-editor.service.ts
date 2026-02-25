import { z } from 'zod'
import { prisma } from '#server/db/prisma'
import type { ServiceResult } from '#server/services/auth.service'
import { buildCampaignWhereForPermission, resolveCampaignAccess } from '#server/utils/campaign-auth'
import type {
  DungeonLinkCreateInput,
  DungeonMapPatchActionInput,
  DungeonMapPatchInput,
  DungeonRoomUpdateInput,
} from '#shared/schemas/dungeon'
import type {
  CampaignDungeonLink,
  CampaignDungeonRoom,
  DungeonMapData,
  DungeonRoomGeometry,
} from '#shared/types/dungeon'
import { parseDungeonMap } from '#server/services/dungeon/dungeon-map-utils'
import type { EncounterCreateInput } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'
import { ActivityLogService } from '#server/services/activity-log.service'

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

const withDungeonAccess = async (
  campaignId: string,
  dungeonId: string,
  userId: string,
  permission: 'content.read' | 'content.write',
) =>
  prisma.campaignDungeon.findFirst({
    where: {
      id: dungeonId,
      campaignId,
      campaign: buildCampaignWhereForPermission(userId, permission),
    },
    select: {
      id: true,
      mapJson: true,
    },
  })

const syncRoomRowsToMap = async (dungeonId: string, rooms: DungeonRoomGeometry[]) => {
  const existing = await prisma.campaignDungeonRoom.findMany({
    where: { dungeonId },
    select: {
      id: true,
      roomNumber: true,
      name: true,
      description: true,
      gmNotes: true,
      playerNotes: true,
      readAloud: true,
      tagsJson: true,
      state: true,
    },
  })
  const byNumber = new Map(existing.map((room) => [room.roomNumber, room]))

  await prisma.$transaction(async (tx) => {
    await tx.campaignDungeonRoom.deleteMany({
      where: { dungeonId },
    })

    if (!rooms.length) return

    for (const room of rooms) {
      const current = byNumber.get(room.roomNumber)
      await tx.campaignDungeonRoom.create({
        data: {
          dungeonId,
          roomNumber: room.roomNumber,
          name: current?.name || `Room ${room.roomNumber}`,
          description: current?.description ?? null,
          gmNotes: current?.gmNotes ?? null,
          playerNotes: current?.playerNotes ?? null,
          readAloud: current?.readAloud ?? null,
          tagsJson: current?.tagsJson ?? [],
          state: current?.state ?? 'UNSEEN',
          boundsJson: {
            x: room.x,
            y: room.y,
            width: room.width,
            height: room.height,
          },
        },
      })
    }
  })
}

const makeRoomId = () => `room-${Math.random().toString(36).slice(2, 10)}`
const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`
const activityLogService = new ActivityLogService()

const normalizeRoomNumbers = (rooms: DungeonMapData['rooms']) =>
  [...rooms]
    .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))
    .map((room, index) => ({ ...room, roomNumber: index + 1 }))

const applyMapAction = (map: DungeonMapData, action: DungeonMapPatchActionInput): DungeonMapData => {
  const next: DungeonMapData = {
    ...map,
    rooms: [...map.rooms],
    corridors: [...map.corridors],
    doors: [...map.doors],
    metadata: {
      ...map.metadata,
      generatedAt: new Date().toISOString(),
    },
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
    return next
  }

  if (action.type === 'MOVE_ROOM') {
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
    const from = next.rooms.some((room) => room.id === action.fromRoomId)
    const to = next.rooms.some((room) => room.id === action.toRoomId)
    if (!from || !to) return next
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
    userId: string,
  ): Promise<ServiceResult<CampaignDungeonRoom[]>> {
    const access = await withDungeonAccess(campaignId, dungeonId, userId, 'content.read')
    if (!access) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
    }

    const rows = await prisma.campaignDungeonRoom.findMany({
      where: { dungeonId: access.id },
      orderBy: [{ roomNumber: 'asc' }],
    })
    const resolved = await resolveCampaignAccess(campaignId, userId)
    const isViewer = resolved.access?.role === 'VIEWER'
    return {
      ok: true,
      data: rows.map((row) => {
        const dto = toRoomDto(row)
        return isViewer ? { ...dto, gmNotes: null } : dto
      }),
    }
  }

  async updateRoom(
    campaignId: string,
    dungeonId: string,
    roomId: string,
    userId: string,
    input: DungeonRoomUpdateInput,
  ): Promise<ServiceResult<CampaignDungeonRoom>> {
    const access = await withDungeonAccess(campaignId, dungeonId, userId, 'content.write')
    if (!access) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
    }

    const existing = await prisma.campaignDungeonRoom.findFirst({
      where: { id: roomId, dungeonId: access.id },
      select: { id: true },
    })
    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Room not found.',
      }
    }

    const updated = await prisma.campaignDungeonRoom.update({
      where: { id: roomId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'description') ? { description: input.description ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'gmNotes') ? { gmNotes: input.gmNotes ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'playerNotes') ? { playerNotes: input.playerNotes ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'readAloud') ? { readAloud: input.readAloud ?? null } : {}),
        ...(input.tags ? { tagsJson: input.tags } : {}),
        ...(input.state ? { state: input.state } : {}),
      },
    })

    return { ok: true, data: toRoomDto(updated) }
  }

  async patchMap(
    campaignId: string,
    dungeonId: string,
    userId: string,
    input: DungeonMapPatchInput,
  ): Promise<ServiceResult<DungeonMapData>> {
    const access = await withDungeonAccess(campaignId, dungeonId, userId, 'content.write')
    if (!access) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
    }

    let map = parseDungeonMap(access.mapJson)
    for (const action of input.actions) {
      map = applyMapAction(map, action)
    }

    await prisma.campaignDungeon.update({
      where: { id: access.id },
      data: { mapJson: map },
    })
    await syncRoomRowsToMap(access.id, map.rooms)
    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_MAP_PATCHED',
      targetType: 'DUNGEON',
      targetId: dungeonId,
      summary: `Patched dungeon map with ${input.actions.length} action(s).`,
    })

    return { ok: true, data: map }
  }

  async createEncounterFromRoom(
    campaignId: string,
    dungeonId: string,
    roomId: string,
    userId: string,
  ): Promise<ServiceResult<{ encounterId: string }>> {
    const access = await withDungeonAccess(campaignId, dungeonId, userId, 'content.write')
    if (!access) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
    }

    const room = await prisma.campaignDungeonRoom.findFirst({
      where: { dungeonId: access.id, id: roomId },
    })
    if (!room) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Room not found.',
      }
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
    if (!created.ok) {
      return created
    }

    await prisma.campaignDungeonLink.create({
      data: {
        dungeonId: access.id,
        roomId,
        linkType: 'ENCOUNTER',
        targetId: created.data.id,
      },
    })
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
        encounterId: created.data.id,
      },
    })

    return {
      ok: true,
      data: { encounterId: created.data.id },
    }
  }

  async listLinks(
    campaignId: string,
    dungeonId: string,
    userId: string,
  ): Promise<ServiceResult<CampaignDungeonLink[]>> {
    const access = await withDungeonAccess(campaignId, dungeonId, userId, 'content.read')
    if (!access) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
    }

    const rows = await prisma.campaignDungeonLink.findMany({
      where: { dungeonId: access.id },
      orderBy: [{ createdAt: 'desc' }],
    })
    return { ok: true, data: rows.map(toLinkDto) }
  }

  async createLink(
    campaignId: string,
    dungeonId: string,
    userId: string,
    input: DungeonLinkCreateInput,
  ): Promise<ServiceResult<CampaignDungeonLink>> {
    const access = await withDungeonAccess(campaignId, dungeonId, userId, 'content.write')
    if (!access) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
    }

    if (input.roomId) {
      const room = await prisma.campaignDungeonRoom.findFirst({
        where: { id: input.roomId, dungeonId: access.id },
        select: { id: true },
      })
      if (!room) {
        return {
          ok: false,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Room id is invalid for this dungeon.',
          fields: { roomId: 'Room not found in this dungeon.' },
        }
      }
    }

    const created = await prisma.campaignDungeonLink.create({
      data: {
        dungeonId: access.id,
        roomId: input.roomId || null,
        linkType: input.linkType,
        targetId: input.targetId,
      },
    })
    return { ok: true, data: toLinkDto(created) }
  }

  async deleteLink(
    campaignId: string,
    dungeonId: string,
    linkId: string,
    userId: string,
  ): Promise<ServiceResult<{ deleted: true }>> {
    const access = await withDungeonAccess(campaignId, dungeonId, userId, 'content.write')
    if (!access) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
    }

    const existing = await prisma.campaignDungeonLink.findFirst({
      where: { id: linkId, dungeonId: access.id },
      select: { id: true },
    })
    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon link not found.',
      }
    }

    await prisma.campaignDungeonLink.delete({
      where: { id: linkId },
    })

    return { ok: true, data: { deleted: true } }
  }
}
