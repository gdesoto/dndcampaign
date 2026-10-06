import { db } from '#server/db/client'
import { campaignDungeon, campaignDungeonSnapshot, type CampaignDungeonSnapshot as SnapshotRow } from '#server/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { dungeonMapSchema, type DungeonSnapshotCreateInput, type DungeonSnapshotUpdateInput } from '#shared/schemas/dungeon'
import type { CampaignDungeonSnapshot, DungeonMapData } from '#shared/types/dungeon'
import { toPlayerSafeMap } from '#shared/utils/dungeon-map'
import { resetDungeonRooms } from '#server/services/dungeon/dungeon.service'
import { ActivityLogService } from '#server/services/activity-log.service'
import { apiError } from '#server/utils/http'
import type { CampaignActor } from '#server/utils/campaign-auth'
const activityLogService = new ActivityLogService()

const toSnapshotDto = (row: SnapshotRow, options: { includeMap?: boolean; viewerSafe?: boolean } = {}): CampaignDungeonSnapshot => {
  const map = dungeonMapSchema.parse(row.mapJson)
  return {
    id: row.id,
    dungeonId: row.dungeonId,
    snapshotType: row.snapshotType,
    label: row.label,
    seed: row.seed,
    generatorVersion: row.generatorVersion,
    mapType: map.mapType ?? 'DUNGEON',
    roomCount: map.rooms.length,
    floorCount: map.floorCount ?? 1,
    ...(options.includeMap ? { map: options.viewerSafe ? toPlayerSafeMap(map) : map } : {}),
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
  }
}

/** Room records keep their saved details when a restore leaves every room where it was. */
const sameRoomGeometry = (current: DungeonMapData, restored: DungeonMapData) => {
  const key = (map: DungeonMapData) => map.rooms
    .map(room => `${room.id}:${room.roomNumber}:${room.x},${room.y}:${room.width}x${room.height}:${room.floor ?? 0}`)
    .sort()
    .join('|')
  return key(current) === key(restored)
}

const withDungeonAccess = async (campaignId: string, dungeonId: string) =>
  db.query.campaignDungeon.findFirst({ where: and(eq(campaignDungeon.id, dungeonId), eq(campaignDungeon.campaignId, campaignId)), columns: {
      id: true,
      seed: true,
      generatorVersion: true,
      configJson: true,
      mapJson: true,
    } }).sync()

const requireDungeon = async (campaignId: string, dungeonId: string) => {
  const access = await withDungeonAccess(campaignId, dungeonId)
  if (!access) {
    throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
  }
  return access
}

export class DungeonSnapshotService {
  async listSnapshots(
    campaignId: string,
    dungeonId: string,
    options: { includeMap?: boolean; viewerSafe?: boolean } = {},
  ): Promise<CampaignDungeonSnapshot[]> {
    const access = await requireDungeon(campaignId, dungeonId)
    const rows = db.query.campaignDungeonSnapshot.findMany({ where: eq(campaignDungeonSnapshot.dungeonId, access.id), orderBy: [desc(campaignDungeonSnapshot.createdAt)] }).sync()
    return rows.map(row => toSnapshotDto(row, options))
  }

  async createSnapshot(
    campaignId: string,
    dungeonId: string,
    actor: CampaignActor,
    input: DungeonSnapshotCreateInput,
  ): Promise<CampaignDungeonSnapshot> {
    const userId = actor.userId
    const access = await requireDungeon(campaignId, dungeonId)

    const created = db.insert(campaignDungeonSnapshot).values({
        dungeonId: access.id,
        snapshotType: input.snapshotType,
        label: input.label ?? null,
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

  async updateSnapshot(
    campaignId: string,
    dungeonId: string,
    snapshotId: string,
    input: DungeonSnapshotUpdateInput,
  ): Promise<CampaignDungeonSnapshot> {
    const access = await requireDungeon(campaignId, dungeonId)
    const updated = db.update(campaignDungeonSnapshot)
      .set({ label: input.label })
      .where(and(eq(campaignDungeonSnapshot.id, snapshotId), eq(campaignDungeonSnapshot.dungeonId, access.id)))
      .returning()
      .get()
    if (!updated) {
      throw apiError(404, 'NOT_FOUND', 'Snapshot not found.')
    }
    return toSnapshotDto(updated)
  }

  async restoreSnapshot(
    campaignId: string,
    dungeonId: string,
    snapshotId: string,
    actor: CampaignActor,
  ): Promise<{ restored: true; roomsReset: boolean }> {
    const userId = actor.userId
    const access = await requireDungeon(campaignId, dungeonId)

    const snapshot = db.query.campaignDungeonSnapshot.findFirst({ where: and(eq(campaignDungeonSnapshot.id, snapshotId), eq(campaignDungeonSnapshot.dungeonId, access.id)), columns: {
        seed: true,
        generatorVersion: true,
        configJson: true,
        mapJson: true,
      } }).sync()
    if (!snapshot) {
      throw apiError(404, 'NOT_FOUND', 'Snapshot not found.')
    }

    const map = dungeonMapSchema.parse(snapshot.mapJson)
    const roomsReset = !sameRoomGeometry(dungeonMapSchema.parse(access.mapJson), map)
    db.update(campaignDungeon).set({
        seed: snapshot.seed,
        generatorVersion: snapshot.generatorVersion,
        configJson: snapshot.configJson,
        mapJson: snapshot.mapJson,
      }).where(eq(campaignDungeon.id, access.id)).returning().get()!
    if (roomsReset) resetDungeonRooms(access.id, map.rooms)
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
    return { restored: true, roomsReset }
  }
}
