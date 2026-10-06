import type { JsonValue } from '#server/db/columns'
import { db } from '#server/db/client'
import { campaignDungeon, campaignDungeonRoom, campaignDungeonSnapshot } from '#server/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import {
  dungeonGeneratorConfigSchema,
  dungeonMapSchema,
  type DungeonCreateInput,
  type DungeonGenerateInput,
  type DungeonListQueryInput,
  type DungeonRegenerateInput,
  type DungeonUpdateInput,
} from '#shared/schemas/dungeon'
import type {
  CampaignDungeonDetail,
  CampaignDungeonRegenerateResult,
  CampaignDungeonStatus,
  CampaignDungeonSummary,
  DungeonGeneratorConfig,
  DungeonRoomGeometry,
} from '#shared/types/dungeon'
import { DungeonGeneratorService } from '#server/services/dungeon/dungeon-generator.service'
import { toPlayerSafeDungeonConfig, toPlayerSafeMap } from '#shared/utils/dungeon-map'
import { ActivityLogService } from '#server/services/activity-log.service'
import { apiError } from '#server/utils/http'
import { hasCampaignDmAccess, type CampaignActor } from '#server/utils/campaign-auth'

/** Each reroll takes an automatic snapshot; only the newest ones are kept. */
const PRE_REGENERATE_SNAPSHOT_LIMIT = 20

const defaultDungeonConfig:DungeonGeneratorConfig = dungeonGeneratorConfigSchema.parse({})
const generator = new DungeonGeneratorService()
const activityLogService = new ActivityLogService()

const toSummary = (row: {
  id: string
  campaignId: string
  name: string
  status: CampaignDungeonStatus
  theme: string
  seed: string
  gridType: 'SQUARE'
  generatorVersion: string
  mapJson: unknown
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
}, canDelete: boolean): CampaignDungeonSummary => {
  const map = dungeonMapSchema.parse(row.mapJson)
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

const toDetail = (row: {
  id: string
  campaignId: string
  name: string
  status: CampaignDungeonStatus
  theme: string
  seed: string
  gridType: 'SQUARE'
  generatorVersion: string
  configJson: unknown
  mapJson: unknown
  playerViewJson: unknown
  createdAt: Date
  updatedAt: Date
}, viewerSafe = false): CampaignDungeonDetail => {
  const config = dungeonGeneratorConfigSchema.parse(row.configJson)
  const parsedMap = dungeonMapSchema.parse(row.mapJson)
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
    config: viewerSafe ? toPlayerSafeDungeonConfig(config) : config,
    map,
    playerView: (row.playerViewJson as Record<string, unknown> | null) || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const withDungeonAccess = async (campaignId: string, dungeonId: string) =>
  db.query.campaignDungeon.findFirst({ where: and(eq(campaignDungeon.id, dungeonId), eq(campaignDungeon.campaignId, campaignId)) }).sync()

export const resetDungeonRooms = (dungeonId: string, rooms: DungeonRoomGeometry[]) => {
  db.transaction((tx) => {
    tx.delete(campaignDungeonRoom).where(eq(campaignDungeonRoom.dungeonId, dungeonId)).run()

    for (const room of rooms) {
      tx.insert(campaignDungeonRoom).values({
        dungeonId,
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

export class DungeonService {
  async listDungeons(
    campaignId: string,
    actor: CampaignActor,
    query: DungeonListQueryInput,
  ): Promise<CampaignDungeonSummary[]> {
    const userId = actor.userId
    const canDeleteAsOwnerOrDm = Boolean(
      actor.access.role === 'OWNER' || actor.access.hasDmAccess,
    )

    const rows = db.query.campaignDungeon.findMany({ where: and(eq(campaignDungeon.campaignId, campaignId), (query.status ? eq(campaignDungeon.status, query.status) : undefined), (query.theme ? eq(campaignDungeon.theme, query.theme) : undefined)), orderBy: [desc(campaignDungeon.updatedAt), desc(campaignDungeon.createdAt)] }).sync()

    return rows.map((row) => toSummary(row, canDeleteAsOwnerOrDm || row.createdByUserId === userId))
  }

  async createDungeon(
    campaignId: string,
    actor: CampaignActor,
    input: DungeonCreateInput,
  ): Promise<CampaignDungeonDetail> {
    const userId = actor.userId

    const seed = input.seed || generator.buildDefaultSeed()
    const config = input.config ? dungeonGeneratorConfigSchema.parse(input.config) : defaultDungeonConfig
    const normalizedConfig = {
      ...config,
      theme: input.theme || config.theme,
    } satisfies DungeonGeneratorConfig

    const map = generator.generateBaseMap(seed, normalizedConfig)

    const created = db.insert(campaignDungeon).values({
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

    resetDungeonRooms(created.id, map.rooms)

    return toDetail({
        ...created,
        configJson: (normalizedConfig) as unknown as JsonValue,
        mapJson: (map) as unknown as JsonValue,
        playerViewJson: created.playerViewJson,
      })
  }

  async getDungeon(campaignId: string, dungeonId: string, actor: CampaignActor): Promise<CampaignDungeonDetail> {
    const row = await withDungeonAccess(campaignId, dungeonId)
    if (!row) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const viewerSafe = actor.access.role === 'VIEWER'
    return toDetail(row, viewerSafe)
  }

  async updateDungeon(
    campaignId: string,
    dungeonId: string,
    actor: CampaignActor,
    input: DungeonUpdateInput,
  ): Promise<CampaignDungeonDetail> {
    const userId = actor.userId
    const existing = await withDungeonAccess(campaignId, dungeonId)
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const currentConfig = dungeonGeneratorConfigSchema.parse(existing.configJson)
    const nextConfig = input.config || currentConfig

    const updated = db.update(campaignDungeon).set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.theme ? { theme: input.theme } : {}),
        ...(input.seed ? { seed: input.seed } : {}),
        ...(input.config ? { configJson: (nextConfig) as unknown as JsonValue } : {}),
      }).where(eq(campaignDungeon.id, dungeonId)).returning().get()!

    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_UPDATED',
      targetType: 'DUNGEON',
      targetId: dungeonId,
      summary: `Updated dungeon "${updated.name}".`,
    })

    return toDetail({ ...updated, configJson: (nextConfig) as unknown as JsonValue })
  }

  async deleteDungeon(campaignId: string, dungeonId: string, actor: CampaignActor): Promise<{ deleted: true }> {
    const userId = actor.userId
    const existing = db.query.campaignDungeon.findFirst({ where: and(eq(campaignDungeon.id, dungeonId), eq(campaignDungeon.campaignId, campaignId)), columns: { id: true, campaignId: true, name: true, createdByUserId: true } }).sync()
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }
    const canDelete = existing.createdByUserId === userId || hasCampaignDmAccess(actor.access)
    if (!canDelete) {
      throw apiError(403, 'FORBIDDEN', 'You do not have permission to delete this dungeon.')
    }

    db.delete(campaignDungeon).where(eq(campaignDungeon.id, dungeonId)).returning().get()!
    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_DELETED',
      targetType: 'DUNGEON',
      targetId: dungeonId,
      summary: `Deleted dungeon "${existing.name}".`,
    })
    return { deleted: true }
  }

  async generateDungeon(
    campaignId: string,
    dungeonId: string,
    actor: CampaignActor,
    input: DungeonGenerateInput,
  ): Promise<CampaignDungeonDetail> {
    const userId = actor.userId
    const existing = await withDungeonAccess(campaignId, dungeonId)
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const seed = input.seed || existing.seed
    const config = input.config
      ? dungeonGeneratorConfigSchema.parse(input.config)
      : dungeonGeneratorConfigSchema.parse(existing.configJson)

    const map = generator.generateBaseMap(seed, config)
    const updated = db.update(campaignDungeon).set({
        seed,
        theme: config.theme,
        configJson: (config) as unknown as JsonValue,
        mapJson: (map) as unknown as JsonValue,
        generatorVersion: generator.getGeneratorVersion(),
      }).where(eq(campaignDungeon.id, dungeonId)).returning().get()!

    resetDungeonRooms(existing.id, map.rooms)
    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_GENERATED',
      targetType: 'DUNGEON',
      targetId: dungeonId,
      summary: `Generated dungeon "${updated.name}".`,
      metadata: {
        scope: 'FULL',
        seed,
      },
    })

    return toDetail({ ...updated, configJson: (config) as unknown as JsonValue, mapJson: (map) as unknown as JsonValue })
  }

  async regenerateDungeon(
    campaignId: string,
    dungeonId: string,
    actor: CampaignActor,
    input: DungeonRegenerateInput,
  ): Promise<CampaignDungeonRegenerateResult> {
    const userId = actor.userId
    const existing = await withDungeonAccess(campaignId, dungeonId)
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const seed = input.seed || existing.seed
    const config = dungeonGeneratorConfigSchema.parse(input.config ?? existing.configJson)
    const currentMap = dungeonMapSchema.parse(existing.mapJson)
    const regenerated = generator.regenerate(input.scope, seed, config, currentMap, {
      preserveLocks: input.preserveLocks,
    })

    const previousSnapshot = db.insert(campaignDungeonSnapshot).values({
        dungeonId: existing.id,
        snapshotType: 'PRE_REGENERATE',
        seed: existing.seed,
        generatorVersion: existing.generatorVersion,
        configJson: (existing.configJson) as unknown as JsonValue,
        mapJson: (existing.mapJson) as unknown as JsonValue,
        createdByUserId: userId,
      }).returning({ id: campaignDungeonSnapshot.id }).get()!
    const expired = db.select({ id: campaignDungeonSnapshot.id }).from(campaignDungeonSnapshot)
      .where(and(eq(campaignDungeonSnapshot.dungeonId, existing.id), eq(campaignDungeonSnapshot.snapshotType, 'PRE_REGENERATE')))
      .orderBy(desc(campaignDungeonSnapshot.createdAt))
      .all()
      .slice(PRE_REGENERATE_SNAPSHOT_LIMIT)
    if (expired.length) {
      db.delete(campaignDungeonSnapshot).where(inArray(campaignDungeonSnapshot.id, expired.map(row => row.id))).run()
    }

    const updated = db.update(campaignDungeon).set({
        seed,
        theme: config.theme,
        configJson: (config) as unknown as JsonValue,
        mapJson: (regenerated) as unknown as JsonValue,
        generatorVersion: generator.getGeneratorVersion(),
      }).where(eq(campaignDungeon.id, dungeonId)).returning().get()!

    if (input.scope === 'FULL' || input.scope === 'LAYOUT') {
      resetDungeonRooms(existing.id, regenerated.rooms)
    }

    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_REGENERATED',
      targetType: 'DUNGEON',
      targetId: dungeonId,
      summary: `Regenerated dungeon "${updated.name}".`,
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
    dungeonId: string,
    actor: CampaignActor,
    status: 'READY' | 'DRAFT',
  ): Promise<CampaignDungeonDetail> {
    const userId = actor.userId
    const existing = db.query.campaignDungeon.findFirst({ where: and(eq(campaignDungeon.id, dungeonId), eq(campaignDungeon.campaignId, campaignId)) }).sync()
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const updated = db.update(campaignDungeon).set({ status }).where(eq(campaignDungeon.id, dungeonId)).returning().get()!
    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: status === 'READY' ? 'DUNGEON_PUBLISHED' : 'DUNGEON_UNPUBLISHED',
      targetType: 'DUNGEON',
      targetId: dungeonId,
      summary: `${status === 'READY' ? 'Published' : 'Unpublished'} dungeon "${updated.name}".`,
    })
    return toDetail(updated)
  }
}
