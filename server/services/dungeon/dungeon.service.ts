import { prisma } from '#server/db/prisma'
import type { Prisma } from '#server/db/prisma-client'
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
import { parseDungeonMap, toPlayerSafeMap } from '#server/services/dungeon/dungeon-map-utils'
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
  prisma.campaignDungeon.findFirst({
    where: {
      id: dungeonId,
      campaignId,
    },
  })

const syncRoomsFromMap = async (dungeonId: string, map: DungeonMapData) => {
  await prisma.$transaction(async (tx) => {
    await tx.campaignDungeonRoom.deleteMany({
      where: { dungeonId },
    })

    if (!map.rooms.length) return

    await tx.campaignDungeonRoom.createMany({
      data: map.rooms.map((room) => ({
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
      })),
    })
  })
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

    const rows = await prisma.campaignDungeon.findMany({
      where: {
        campaignId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.theme ? { theme: query.theme } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })

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

    const created = await prisma.campaignDungeon.create({
      data: {
        campaignId,
        name: input.name,
        status: 'DRAFT',
        theme: input.theme,
        seed,
        gridType: 'SQUARE',
        generatorVersion: generator.getGeneratorVersion(),
        configJson: normalizedConfig,
        mapJson: map,
        createdByUserId: userId,
      },
    })

    await syncRoomsFromMap(created.id, map)

    return toDetail({
        ...created,
        configJson: normalizedConfig,
        mapJson: map,
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

    const updated = await prisma.campaignDungeon.update({
      where: { id: dungeonId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.theme ? { theme: input.theme } : {}),
        ...(input.seed ? { seed: input.seed } : {}),
        ...(input.config ? { configJson: nextConfig } : {}),
      },
    })

    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_UPDATED',
      targetType: 'DUNGEON',
      targetId: dungeonId,
      summary: `Updated dungeon "${updated.name}".`,
    })

    return toDetail({ ...updated, configJson: nextConfig })
  }

  async deleteDungeon(campaignId: string, dungeonId: string, actor: CampaignActor): Promise<{ deleted: true }> {
    const userId = actor.userId
    const existing = await prisma.campaignDungeon.findFirst({
      where: { id: dungeonId, campaignId },
      select: { id: true, campaignId: true, name: true, createdByUserId: true },
    })
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }
    const canDelete = existing.createdByUserId === userId || hasCampaignDmAccess(actor.access)
    if (!canDelete) {
      throw apiError(403, 'FORBIDDEN', 'You do not have permission to delete this dungeon.')
    }

    await prisma.campaignDungeon.delete({ where: { id: dungeonId } })
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
    const updated = await prisma.campaignDungeon.update({
      where: { id: dungeonId },
      data: {
        seed,
        theme: config.theme,
        configJson: config,
        mapJson: map,
        generatorVersion: generator.getGeneratorVersion(),
      },
    })

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

    return toDetail({ ...updated, configJson: config, mapJson: map })
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

    await prisma.campaignDungeonSnapshot.create({
      data: {
        dungeonId: existing.id,
        snapshotType: 'PRE_REGENERATE',
        seed: existing.seed,
        generatorVersion: existing.generatorVersion,
        configJson: existing.configJson as Prisma.InputJsonValue,
        mapJson: existing.mapJson as Prisma.InputJsonValue,
        createdByUserId: userId,
      },
    })

    const updated = await prisma.campaignDungeon.update({
      where: { id: dungeonId },
      data: {
        seed,
        mapJson: regenerated,
        generatorVersion: generator.getGeneratorVersion(),
      },
    })

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

    return toDetail({ ...updated, configJson: config, mapJson: regenerated })
  }

  async setPublishStatus(
    campaignId: string,
    dungeonId: string,
    actor: CampaignActor,
    status: 'READY' | 'DRAFT',
  ): Promise<CampaignDungeonDetail> {
    const userId = actor.userId
    const existing = await prisma.campaignDungeon.findFirst({
      where: { id: dungeonId, campaignId },
    })
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const updated = await prisma.campaignDungeon.update({
      where: { id: dungeonId },
      data: { status },
    })
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
