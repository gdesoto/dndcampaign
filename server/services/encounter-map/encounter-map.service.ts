import type { JsonValue } from '#server/db/columns'
import { db } from '#server/db/client'
import { campaignDungeon as campaignEncounterMap, campaignDungeonRoom as campaignEncounterMapRoom, campaignDungeonSnapshot as campaignEncounterMapSnapshot, type CampaignDungeon as EncounterMapRow } from '#server/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import {
  encounterMapGeneratorConfigSchema,
  encounterMapSchema,
  type EncounterMapCreateInput,
  type EncounterMapGenerateInput,
  type EncounterMapListQueryInput,
  type EncounterMapRegenerateInput,
  type EncounterMapUpdateInput,
} from '#shared/schemas/encounter-map'
import type {
  CampaignEncounterMapDetail,
  CampaignEncounterMapRegenerateResult,
  CampaignEncounterMapSummary,
  EncounterMapGeneratorConfig,
  EncounterMapRoomGeometry,
} from '#shared/types/encounter-map'
import { EncounterMapGeneratorService } from '#server/services/encounter-map/encounter-map-generator.service'
import { toPlayerSafeEncounterMapConfig, toPlayerSafeMap } from '#shared/utils/encounter-map'
import { ActivityLogService } from '#server/services/activity-log.service'
import { apiError } from '#server/utils/http'
import { hasCampaignDmAccess, type CampaignActor } from '#server/utils/campaign-auth'

/** Each reroll takes an automatic snapshot; only the newest ones are kept. */
const PRE_REGENERATE_SNAPSHOT_LIMIT = 20

const defaultEncounterMapConfig:EncounterMapGeneratorConfig = encounterMapGeneratorConfigSchema.parse({})
const generator = new EncounterMapGeneratorService()
const activityLogService = new ActivityLogService()

const toSummary = (row: EncounterMapRow, canDelete: boolean): CampaignEncounterMapSummary => {
  const map = encounterMapSchema.parse(row.mapJson)
  return {
    id: row.id,
    campaignId: row.campaignId,
    name: row.name,
    status: row.status,
    theme: row.theme,
    seed: row.seed,
    gridType: row.gridType,
    generatorVersion: row.generatorVersion,
    roomCount: map.rooms.length,
    mapType: map.mapType ?? 'DUNGEON',
    floorCount: map.floorCount ?? 1,
    canDelete,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const toDetail = (row: EncounterMapRow, viewerSafe = false): CampaignEncounterMapDetail => {
  const config = encounterMapGeneratorConfigSchema.parse(row.configJson)
  const parsedMap = encounterMapSchema.parse(row.mapJson)
  const map = viewerSafe ? toPlayerSafeMap(parsedMap) : parsedMap

  return {
    id: row.id,
    campaignId: row.campaignId,
    name: row.name,
    status: row.status,
    theme: row.theme,
    seed: row.seed,
    gridType: row.gridType,
    generatorVersion: row.generatorVersion,
    roomCount: map.rooms.length,
    mapType: map.mapType ?? 'DUNGEON',
    floorCount: map.floorCount ?? 1,
    config: viewerSafe ? toPlayerSafeEncounterMapConfig(config) : config,
    map,
    playerView: (row.playerViewJson as Record<string, unknown> | null) || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const withEncounterMapAccess = async (campaignId: string, encounterMapId: string) =>
  db.query.campaignDungeon.findFirst({ where: and(eq(campaignEncounterMap.id, encounterMapId), eq(campaignEncounterMap.campaignId, campaignId)) }).sync()

export const resetEncounterMapRooms = (encounterMapId: string, rooms: EncounterMapRoomGeometry[]) => {
  db.transaction((tx) => {
    tx.delete(campaignEncounterMapRoom).where(eq(campaignEncounterMapRoom.dungeonId, encounterMapId)).run()

    for (const room of rooms) {
      tx.insert(campaignEncounterMapRoom).values({
        dungeonId: encounterMapId,
        roomNumber: room.roomNumber,
        name: room.label || `Room ${room.roomNumber}`,
        description: null,
        gmNotes: null,
        playerNotes: null,
        readAloud: null,
        tagsJson: [],
        boundsJson: {
          x: room.x,
          y: room.y,
          width: room.width,
          height: room.height,
          floor: room.floor ?? 0,
        },
      }).run()
    }
  }, { behavior: 'immediate' })
}

export class EncounterMapService {
  async listEncounterMaps(
    campaignId: string,
    actor: CampaignActor,
    query: EncounterMapListQueryInput,
  ): Promise<CampaignEncounterMapSummary[]> {
    const userId = actor.userId
    const canDeleteAsOwnerOrDm = Boolean(
      actor.access.role === 'OWNER' || actor.access.hasDmAccess,
    )

    const rows = db.query.campaignDungeon.findMany({ where: and(eq(campaignEncounterMap.campaignId, campaignId), (query.status ? eq(campaignEncounterMap.status, query.status) : undefined), (query.theme ? eq(campaignEncounterMap.theme, query.theme) : undefined)), orderBy: [desc(campaignEncounterMap.updatedAt), desc(campaignEncounterMap.createdAt)] }).sync()

    return rows.map((row) => toSummary(row, canDeleteAsOwnerOrDm || row.createdByUserId === userId))
  }

  async createEncounterMap(
    campaignId: string,
    actor: CampaignActor,
    input: EncounterMapCreateInput,
  ): Promise<CampaignEncounterMapDetail> {
    const userId = actor.userId

    const seed = input.seed || generator.buildDefaultSeed()
    const config = input.config ? encounterMapGeneratorConfigSchema.parse(input.config) : defaultEncounterMapConfig
    const normalizedConfig = {
      ...config,
      theme: input.theme || config.theme,
    } satisfies EncounterMapGeneratorConfig

    const map = generator.generateBaseMap(seed, normalizedConfig)

    const created = db.insert(campaignEncounterMap).values({
        campaignId,
        name: input.name,
        status: 'DRAFT',
        theme: input.theme,
        seed,
        gridType: 'SQUARE',
        generatorVersion: generator.getGeneratorVersion(),
        configJson: (normalizedConfig) as unknown as JsonValue,
        mapJson: (map) as unknown as JsonValue,
        createdByUserId: userId,
      }).returning().get()!

    resetEncounterMapRooms(created.id, map.rooms)

    return toDetail({
        ...created,
        configJson: (normalizedConfig) as unknown as JsonValue,
        mapJson: (map) as unknown as JsonValue,
        playerViewJson: created.playerViewJson,
      })
  }

  async getEncounterMap(campaignId: string, encounterMapId: string, actor: CampaignActor): Promise<CampaignEncounterMapDetail> {
    const row = await withEncounterMapAccess(campaignId, encounterMapId)
    if (!row) {
      throw apiError(404, 'NOT_FOUND', 'Encounter map not found or access denied.')
    }

    const viewerSafe = actor.access.role === 'VIEWER'
    return toDetail(row, viewerSafe)
  }

  async updateEncounterMap(
    campaignId: string,
    encounterMapId: string,
    actor: CampaignActor,
    input: EncounterMapUpdateInput,
  ): Promise<CampaignEncounterMapDetail> {
    const userId = actor.userId
    const existing = await withEncounterMapAccess(campaignId, encounterMapId)
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter map not found or access denied.')
    }

    const currentConfig = encounterMapGeneratorConfigSchema.parse(existing.configJson)
    const nextConfig = input.config || currentConfig

    const updated = db.update(campaignEncounterMap).set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.theme ? { theme: input.theme } : {}),
        ...(input.seed ? { seed: input.seed } : {}),
        ...(input.config ? { configJson: (nextConfig) as unknown as JsonValue } : {}),
      }).where(eq(campaignEncounterMap.id, encounterMapId)).returning().get()!

    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_UPDATED',
      targetType: 'DUNGEON',
      targetId: encounterMapId,
      summary: `Updated encounter map "${updated.name}".`,
    })

    return toDetail({ ...updated, configJson: (nextConfig) as unknown as JsonValue })
  }

  async deleteEncounterMap(campaignId: string, encounterMapId: string, actor: CampaignActor): Promise<{ deleted: true }> {
    const userId = actor.userId
    const existing = db.query.campaignDungeon.findFirst({ where: and(eq(campaignEncounterMap.id, encounterMapId), eq(campaignEncounterMap.campaignId, campaignId)), columns: { id: true, campaignId: true, name: true, createdByUserId: true } }).sync()
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter map not found or access denied.')
    }
    const canDelete = existing.createdByUserId === userId || hasCampaignDmAccess(actor.access)
    if (!canDelete) {
      throw apiError(403, 'FORBIDDEN', 'You do not have permission to delete this encounter map.')
    }

    db.delete(campaignEncounterMap).where(eq(campaignEncounterMap.id, encounterMapId)).returning().get()!
    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_DELETED',
      targetType: 'DUNGEON',
      targetId: encounterMapId,
      summary: `Deleted encounter map "${existing.name}".`,
    })
    return { deleted: true }
  }

  async generateEncounterMap(
    campaignId: string,
    encounterMapId: string,
    actor: CampaignActor,
    input: EncounterMapGenerateInput,
  ): Promise<CampaignEncounterMapDetail> {
    const userId = actor.userId
    const existing = await withEncounterMapAccess(campaignId, encounterMapId)
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter map not found or access denied.')
    }

    const seed = input.seed || existing.seed
    const config = input.config
      ? encounterMapGeneratorConfigSchema.parse(input.config)
      : encounterMapGeneratorConfigSchema.parse(existing.configJson)

    const map = generator.generateBaseMap(seed, config)
    const updated = db.update(campaignEncounterMap).set({
        seed,
        theme: config.theme,
        configJson: (config) as unknown as JsonValue,
        mapJson: (map) as unknown as JsonValue,
        generatorVersion: generator.getGeneratorVersion(),
      }).where(eq(campaignEncounterMap.id, encounterMapId)).returning().get()!

    resetEncounterMapRooms(existing.id, map.rooms)
    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_GENERATED',
      targetType: 'DUNGEON',
      targetId: encounterMapId,
      summary: `Generated encounter map "${updated.name}".`,
      metadata: {
        scope: 'FULL',
        seed,
      },
    })

    return toDetail({ ...updated, configJson: (config) as unknown as JsonValue, mapJson: (map) as unknown as JsonValue })
  }

  async regenerateEncounterMap(
    campaignId: string,
    encounterMapId: string,
    actor: CampaignActor,
    input: EncounterMapRegenerateInput,
  ): Promise<CampaignEncounterMapRegenerateResult> {
    const userId = actor.userId
    const existing = await withEncounterMapAccess(campaignId, encounterMapId)
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter map not found or access denied.')
    }

    const seed = input.seed || existing.seed
    const config = encounterMapGeneratorConfigSchema.parse(input.config ?? existing.configJson)
    const currentMap = encounterMapSchema.parse(existing.mapJson)
    const regenerated = generator.regenerate(input.scope, seed, config, currentMap, {
      preserveLocks: input.preserveLocks,
    })

    const previousSnapshot = db.insert(campaignEncounterMapSnapshot).values({
        dungeonId: existing.id,
        snapshotType: 'PRE_REGENERATE',
        seed: existing.seed,
        generatorVersion: existing.generatorVersion,
        configJson: (existing.configJson) as unknown as JsonValue,
        mapJson: (existing.mapJson) as unknown as JsonValue,
        createdByUserId: userId,
      }).returning({ id: campaignEncounterMapSnapshot.id }).get()!
    const expired = db.select({ id: campaignEncounterMapSnapshot.id }).from(campaignEncounterMapSnapshot)
      .where(and(eq(campaignEncounterMapSnapshot.dungeonId, existing.id), eq(campaignEncounterMapSnapshot.snapshotType, 'PRE_REGENERATE')))
      .orderBy(desc(campaignEncounterMapSnapshot.createdAt))
      .all()
      .slice(PRE_REGENERATE_SNAPSHOT_LIMIT)
    if (expired.length) {
      db.delete(campaignEncounterMapSnapshot).where(inArray(campaignEncounterMapSnapshot.id, expired.map(row => row.id))).run()
    }

    const updated = db.update(campaignEncounterMap).set({
        seed,
        theme: config.theme,
        configJson: (config) as unknown as JsonValue,
        mapJson: (regenerated) as unknown as JsonValue,
        generatorVersion: generator.getGeneratorVersion(),
      }).where(eq(campaignEncounterMap.id, encounterMapId)).returning().get()!

    if (input.scope === 'FULL' || input.scope === 'LAYOUT') {
      resetEncounterMapRooms(existing.id, regenerated.rooms)
    }

    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_REGENERATED',
      targetType: 'DUNGEON',
      targetId: encounterMapId,
      summary: `Regenerated encounter map "${updated.name}".`,
      metadata: {
        scope: input.scope,
        seed,
        preserveLocks: input.preserveLocks,
      },
    })

    return {
      ...toDetail({ ...updated, configJson: (config) as unknown as JsonValue, mapJson: (regenerated) as unknown as JsonValue }),
      previousSnapshotId: previousSnapshot.id,
    }
  }

  async setPublishStatus(
    campaignId: string,
    encounterMapId: string,
    actor: CampaignActor,
    status: 'READY' | 'DRAFT',
  ): Promise<CampaignEncounterMapDetail> {
    const userId = actor.userId
    const existing = db.query.campaignDungeon.findFirst({ where: and(eq(campaignEncounterMap.id, encounterMapId), eq(campaignEncounterMap.campaignId, campaignId)) }).sync()
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter map not found or access denied.')
    }

    const updated = db.update(campaignEncounterMap).set({ status }).where(eq(campaignEncounterMap.id, encounterMapId)).returning().get()!
    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: status === 'READY' ? 'DUNGEON_PUBLISHED' : 'DUNGEON_UNPUBLISHED',
      targetType: 'DUNGEON',
      targetId: encounterMapId,
      summary: `${status === 'READY' ? 'Published' : 'Unpublished'} encounter map "${updated.name}".`,
    })
    return toDetail(updated)
  }
}
