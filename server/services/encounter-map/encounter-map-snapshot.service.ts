import { db } from '#server/db/client'
import { campaignDungeon as campaignEncounterMap, campaignDungeonSnapshot as campaignEncounterMapSnapshot, type CampaignDungeonSnapshot as SnapshotRow } from '#server/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { encounterMapSchema, type EncounterMapSnapshotCreateInput, type EncounterMapSnapshotUpdateInput } from '#shared/schemas/encounter-map'
import type { CampaignEncounterMapSnapshot, EncounterMapData } from '#shared/types/encounter-map'
import { toPlayerSafeMap } from '#shared/utils/encounter-map'
import { resetEncounterMapRooms } from '#server/services/encounter-map/encounter-map.service'
import { ActivityLogService } from '#server/services/activity-log.service'
import { apiError } from '#server/utils/http'
import type { CampaignActor } from '#server/utils/campaign-auth'
const activityLogService = new ActivityLogService()

const toSnapshotDto = (row: SnapshotRow, options: { includeMap?: boolean; viewerSafe?: boolean } = {}): CampaignEncounterMapSnapshot => {
  const map = encounterMapSchema.parse(row.mapJson)
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
const sameRoomGeometry = (current: EncounterMapData, restored: EncounterMapData) => {
  const key = (map: EncounterMapData) => map.rooms
    .map(room => `${room.id}:${room.roomNumber}:${room.x},${room.y}:${room.width}x${room.height}:${room.floor ?? 0}`)
    .sort()
    .join('|')
  return key(current) === key(restored)
}

const requireEncounterMap = (campaignId: string, encounterMapId: string) => {
  const access = db.query.campaignDungeon.findFirst({ where: and(eq(campaignEncounterMap.id, encounterMapId), eq(campaignEncounterMap.campaignId, campaignId)), columns: {
      id: true,
      seed: true,
      generatorVersion: true,
      configJson: true,
      mapJson: true,
    } }).sync()
  if (!access) {
    throw apiError(404, 'NOT_FOUND', 'Encounter map not found or access denied.')
  }
  return access
}

export class EncounterMapSnapshotService {
  async listSnapshots(
    campaignId: string,
    encounterMapId: string,
    options: { includeMap?: boolean; viewerSafe?: boolean } = {},
  ): Promise<CampaignEncounterMapSnapshot[]> {
    const access = requireEncounterMap(campaignId, encounterMapId)
    const rows = db.query.campaignDungeonSnapshot.findMany({ where: eq(campaignEncounterMapSnapshot.dungeonId, access.id), orderBy: [desc(campaignEncounterMapSnapshot.createdAt)] }).sync()
    return rows.map(row => toSnapshotDto(row, options))
  }

  async createSnapshot(
    campaignId: string,
    encounterMapId: string,
    actor: CampaignActor,
    input: EncounterMapSnapshotCreateInput,
  ): Promise<CampaignEncounterMapSnapshot> {
    const userId = actor.userId
    const access = requireEncounterMap(campaignId, encounterMapId)

    const created = db.insert(campaignEncounterMapSnapshot).values({
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
      targetId: encounterMapId,
      summary: `Created ${input.snapshotType} encounter map snapshot.`,
    })
    return toSnapshotDto(created)
  }

  async updateSnapshot(
    campaignId: string,
    encounterMapId: string,
    snapshotId: string,
    input: EncounterMapSnapshotUpdateInput,
  ): Promise<CampaignEncounterMapSnapshot> {
    const access = requireEncounterMap(campaignId, encounterMapId)
    const updated = db.update(campaignEncounterMapSnapshot)
      .set({ label: input.label })
      .where(and(eq(campaignEncounterMapSnapshot.id, snapshotId), eq(campaignEncounterMapSnapshot.dungeonId, access.id)))
      .returning()
      .get()
    if (!updated) {
      throw apiError(404, 'NOT_FOUND', 'Snapshot not found.')
    }
    return toSnapshotDto(updated)
  }

  async restoreSnapshot(
    campaignId: string,
    encounterMapId: string,
    snapshotId: string,
    actor: CampaignActor,
  ): Promise<{ restored: true; roomsReset: boolean }> {
    const userId = actor.userId
    const access = requireEncounterMap(campaignId, encounterMapId)

    const snapshot = db.query.campaignDungeonSnapshot.findFirst({ where: and(eq(campaignEncounterMapSnapshot.id, snapshotId), eq(campaignEncounterMapSnapshot.dungeonId, access.id)), columns: {
        seed: true,
        generatorVersion: true,
        configJson: true,
        mapJson: true,
      } }).sync()
    if (!snapshot) {
      throw apiError(404, 'NOT_FOUND', 'Snapshot not found.')
    }

    const map = encounterMapSchema.parse(snapshot.mapJson)
    const roomsReset = !sameRoomGeometry(encounterMapSchema.parse(access.mapJson), map)
    db.update(campaignEncounterMap).set({
        seed: snapshot.seed,
        generatorVersion: snapshot.generatorVersion,
        configJson: snapshot.configJson,
        mapJson: snapshot.mapJson,
      }).where(eq(campaignEncounterMap.id, access.id)).returning().get()!
    if (roomsReset) resetEncounterMapRooms(access.id, map.rooms)
    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_SNAPSHOT_RESTORED',
      targetType: 'DUNGEON',
      targetId: encounterMapId,
      summary: 'Restored encounter map snapshot.',
      metadata: { snapshotId },
    })
    return { restored: true, roomsReset }
  }
}
