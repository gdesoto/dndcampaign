import { prisma } from '#server/db/prisma'
import type { Prisma } from '#server/db/prisma-client'
import type { DungeonSnapshotCreateInput } from '#shared/schemas/dungeon'
import type { CampaignDungeonSnapshot, DungeonMapData } from '#shared/types/dungeon'
import { parseDungeonMap } from '#server/services/dungeon/dungeon-map-utils'
import { ActivityLogService } from '#server/services/activity-log.service'
import { apiError } from '#server/utils/http'
import type { CampaignActor } from '#server/utils/campaign-auth'
const activityLogService = new ActivityLogService()

const toSnapshotDto = (row: {
  id: string
  dungeonId: string
  snapshotType: 'AUTO' | 'MANUAL' | 'PRE_REGENERATE'
  seed: string
  generatorVersion: string
  createdByUserId: string
  createdAt: Date
}): CampaignDungeonSnapshot => ({
  id: row.id,
  dungeonId: row.dungeonId,
  snapshotType: row.snapshotType,
  seed: row.seed,
  generatorVersion: row.generatorVersion,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
})

const withDungeonAccess = async (campaignId: string, dungeonId: string) =>
  prisma.campaignDungeon.findFirst({
    where: {
      id: dungeonId,
      campaignId,
    },
    select: {
      id: true,
      seed: true,
      generatorVersion: true,
      configJson: true,
      mapJson: true,
    },
  })

const syncRoomRowsToMap = async (dungeonId: string, map: DungeonMapData) => {
  await prisma.$transaction(async (tx) => {
    await tx.campaignDungeonRoom.deleteMany({
      where: { dungeonId },
    })
    for (const room of map.rooms) {
      await tx.campaignDungeonRoom.create({
        data: {
          dungeonId,
          roomNumber: room.roomNumber,
          name: `Room ${room.roomNumber}`,
          description: null,
          gmNotes: null,
          playerNotes: null,
          readAloud: null,
          tagsJson: [],
          state: 'UNSEEN',
          boundsJson: { x: room.x, y: room.y, width: room.width, height: room.height },
        },
      })
    }
  })
}

export class DungeonSnapshotService {
  async listSnapshots(campaignId: string, dungeonId: string): Promise<CampaignDungeonSnapshot[]> {
    const access = await withDungeonAccess(campaignId, dungeonId)
    if (!access) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const rows = await prisma.campaignDungeonSnapshot.findMany({
      where: { dungeonId: access.id },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map(toSnapshotDto)
  }

  async createSnapshot(
    campaignId: string,
    dungeonId: string,
    actor: CampaignActor,
    input: DungeonSnapshotCreateInput,
  ): Promise<CampaignDungeonSnapshot> {
    const userId = actor.userId
    const access = await withDungeonAccess(campaignId, dungeonId)
    if (!access) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const created = await prisma.campaignDungeonSnapshot.create({
      data: {
        dungeonId: access.id,
        snapshotType: input.snapshotType,
        seed: access.seed,
        generatorVersion: access.generatorVersion,
        configJson: access.configJson as Prisma.InputJsonValue,
        mapJson: access.mapJson as Prisma.InputJsonValue,
        createdByUserId: userId,
      },
    })
    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_SNAPSHOT_CREATED',
      targetType: 'DUNGEON',
      targetId: dungeonId,
      summary: `Created ${input.snapshotType} dungeon snapshot.`,
    })
    return toSnapshotDto(created)
  }

  async restoreSnapshot(
    campaignId: string,
    dungeonId: string,
    snapshotId: string,
    actor: CampaignActor,
  ): Promise<{ restored: true }> {
    const userId = actor.userId
    const access = await withDungeonAccess(campaignId, dungeonId)
    if (!access) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const snapshot = await prisma.campaignDungeonSnapshot.findFirst({
      where: { id: snapshotId, dungeonId: access.id },
      select: {
        seed: true,
        generatorVersion: true,
        configJson: true,
        mapJson: true,
      },
    })
    if (!snapshot) {
      throw apiError(404, 'NOT_FOUND', 'Snapshot not found.')
    }

    const map = parseDungeonMap(snapshot.mapJson)
    await prisma.campaignDungeon.update({
      where: { id: access.id },
      data: {
        seed: snapshot.seed,
        generatorVersion: snapshot.generatorVersion,
        configJson: snapshot.configJson as Prisma.InputJsonValue,
        mapJson: snapshot.mapJson as Prisma.InputJsonValue,
      },
    })
    await syncRoomRowsToMap(access.id, map)
    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_SNAPSHOT_RESTORED',
      targetType: 'DUNGEON',
      targetId: dungeonId,
      summary: 'Restored dungeon snapshot.',
      metadata: { snapshotId },
    })
    return { restored: true }
  }
}
