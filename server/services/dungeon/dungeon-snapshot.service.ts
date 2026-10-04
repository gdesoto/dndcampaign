import { db } from '#server/db/client'
import { campaignDungeon, campaignDungeonRoom, campaignDungeonSnapshot } from '#server/db/schema'
import { eq, and, desc } from 'drizzle-orm'
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
  db.query.campaignDungeon.findFirst({ where: and(eq(campaignDungeon.id, dungeonId), eq(campaignDungeon.campaignId, campaignId)), columns: {
      id: true,
      seed: true,
      generatorVersion: true,
      configJson: true,
      mapJson: true,
    } }).sync()

const syncRoomRowsToMap = async (dungeonId: string, map: DungeonMapData) => {
  db.transaction((tx) => {
    tx.delete(campaignDungeonRoom).where(eq(campaignDungeonRoom.dungeonId, dungeonId)).run()
    for (const room of map.rooms) {
      tx.insert(campaignDungeonRoom).values({
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
        }).returning().get()!
    }
  }, { behavior: 'immediate' })
}

export class DungeonSnapshotService {
  async listSnapshots(campaignId: string, dungeonId: string): Promise<CampaignDungeonSnapshot[]> {
    const access = await withDungeonAccess(campaignId, dungeonId)
    if (!access) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const rows = db.query.campaignDungeonSnapshot.findMany({ where: eq(campaignDungeonSnapshot.dungeonId, access.id), orderBy: [desc(campaignDungeonSnapshot.createdAt)] }).sync()
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

    const created = db.insert(campaignDungeonSnapshot).values({
        dungeonId: access.id,
        snapshotType: input.snapshotType,
        seed: access.seed,
        generatorVersion: access.generatorVersion,
        configJson: access.configJson,
        mapJson: access.mapJson,
        createdByUserId: userId,
      }).returning().get()!
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

    const snapshot = db.query.campaignDungeonSnapshot.findFirst({ where: and(eq(campaignDungeonSnapshot.id, snapshotId), eq(campaignDungeonSnapshot.dungeonId, access.id)), columns: {
        seed: true,
        generatorVersion: true,
        configJson: true,
        mapJson: true,
      } }).sync()
    if (!snapshot) {
      throw apiError(404, 'NOT_FOUND', 'Snapshot not found.')
    }

    const map = parseDungeonMap(snapshot.mapJson)
    db.update(campaignDungeon).set({
        seed: snapshot.seed,
        generatorVersion: snapshot.generatorVersion,
        configJson: snapshot.configJson,
        mapJson: snapshot.mapJson,
      }).where(eq(campaignDungeon.id, access.id)).returning().get()!
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
