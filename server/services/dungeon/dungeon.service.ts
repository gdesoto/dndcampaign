import type { JsonValue } from '#server/db/columns'
import { db } from '#server/db/client'
import { campaignDungeon, campaignDungeonRoom, campaignDungeonSnapshot } from '#server/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import {
  dungeonGeneratorConfigSchema,
  type DungeonCreateInput,
  type DungeonGenerateInput,
  type DungeonListQueryInput,
  type DungeonRegenerateInput,
  type DungeonUpdateInput,
} from '#shared/schemas/dungeon'
import type {
  CampaignDungeonDetail,
  CampaignDungeonStatus,
  CampaignDungeonSummary,
  DungeonGeneratorConfig,
  DungeonMapData,
} from '#shared/types/dungeon'
import { DungeonGeneratorService } from '#server/services/dungeon/dungeon-generator.service'
import { parseDungeonMap } from '#server/services/dungeon/dungeon-map-utils'
import { toPlayerSafeMap } from '#shared/utils/dungeon-map'
import { ActivityLogService } from '#server/services/activity-log.service'
import { apiError } from '#server/utils/http'
import { hasCampaignDmAccess, type CampaignActor } from '#server/utils/campaign-auth'

const defaultDungeonConfig: DungeonGeneratorConfig = dungeonGeneratorConfigSchema.parse({})
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
  const map = parseDungeonMap(row.mapJson)
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
  const parsedMap = parseDungeonMap(row.mapJson)
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
    config,
    map,
    playerView: (row.playerViewJson as Record<string, unknown> | null) || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const withDungeonAccess = async (campaignId: string, dungeonId: string) =>
  db.query.campaignDungeon.findFirst({ where: and(eq(campaignDungeon.id, dungeonId), eq(campaignDungeon.campaignId, campaignId)) }).sync()

const syncRoomsFromMap = async (dungeonId: string, map: DungeonMapData) => {
  db.transaction((tx) => {
    tx.delete(campaignDungeonRoom).where(eq(campaignDungeonRoom.dungeonId, dungeonId)).run()

    if (!map.rooms.length) return

    tx.insert(campaignDungeonRoom).values(map.rooms.map((room) => ({
        dungeonId,
        roomNumber: room.roomNumber,
        name: `Room ${room.roomNumber}`,
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
        },
      }))).run()
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

    await syncRoomsFromMap(created.id, map)

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

    await syncRoomsFromMap(existing.id, map)
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
  ): Promise<CampaignDungeonDetail> {
    const userId = actor.userId
    const existing = await withDungeonAccess(campaignId, dungeonId)
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const seed = input.seed || existing.seed
    const config = dungeonGeneratorConfigSchema.parse(existing.configJson)
    const currentMap = parseDungeonMap(existing.mapJson)
    const regenerated = generator.regenerate(input.scope, seed, config, currentMap, {
      preserveLocks: input.preserveLocks,
    })

    db.insert(campaignDungeonSnapshot).values({
        dungeonId: existing.id,
        snapshotType: 'PRE_REGENERATE',
        seed: existing.seed,
        generatorVersion: existing.generatorVersion,
        configJson: (existing.configJson) as unknown as JsonValue,
        mapJson: (existing.mapJson) as unknown as JsonValue,
        createdByUserId: userId,
      }).returning().get()!

    const updated = db.update(campaignDungeon).set({
        seed,
        mapJson: (regenerated) as unknown as JsonValue,
        generatorVersion: generator.getGeneratorVersion(),
      }).where(eq(campaignDungeon.id, dungeonId)).returning().get()!

    if (input.scope === 'FULL' || input.scope === 'LAYOUT') {
      await syncRoomsFromMap(existing.id, regenerated)
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

    return toDetail({ ...updated, configJson: (config) as unknown as JsonValue, mapJson: (regenerated) as unknown as JsonValue })
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
