import { prisma } from '#server/db/prisma'
import type { Prisma } from '#server/db/prisma-client'
import type { ServiceResult } from '#server/services/auth.service'
import { buildCampaignWhereForPermission, resolveCampaignAccess } from '#server/utils/campaign-auth'
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
  createdAt: Date
  updatedAt: Date
}): CampaignDungeonSummary => {
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

const ensureCampaignAccess = async (
  campaignId: string,
  userId: string,
  permission: 'content.read' | 'content.write',
): Promise<ServiceResult<true>> => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ...buildCampaignWhereForPermission(userId, permission) },
    select: { id: true },
  })

  if (!campaign) {
    return {
      ok: false,
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Campaign not found or access denied.',
    }
  }

  return { ok: true, data: true }
}

const withDungeonAccess = async (
  dungeonId: string,
  campaignId: string,
  userId: string,
  permission: 'content.read' | 'content.write',
) =>
  prisma.campaignDungeon.findFirst({
    where: {
      id: dungeonId,
      campaignId,
      campaign: buildCampaignWhereForPermission(userId, permission),
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
    userId: string,
    query: DungeonListQueryInput,
  ): Promise<ServiceResult<CampaignDungeonSummary[]>> {
    const access = await ensureCampaignAccess(campaignId, userId, 'content.read')
    if (!access.ok) return access

    const rows = await prisma.campaignDungeon.findMany({
      where: {
        campaignId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.theme ? { theme: query.theme } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })

    return { ok: true, data: rows.map(toSummary) }
  }

  async createDungeon(
    campaignId: string,
    userId: string,
    input: DungeonCreateInput,
  ): Promise<ServiceResult<CampaignDungeonDetail>> {
    const access = await ensureCampaignAccess(campaignId, userId, 'content.write')
    if (!access.ok) return access

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

    return {
      ok: true,
      data: toDetail({
        ...created,
        configJson: normalizedConfig,
        mapJson: map,
        playerViewJson: created.playerViewJson,
      }),
    }
  }

  async getDungeon(campaignId: string, dungeonId: string, userId: string): Promise<ServiceResult<CampaignDungeonDetail>> {
    const row = await withDungeonAccess(dungeonId, campaignId, userId, 'content.read')
    if (!row) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
    }

    const access = await resolveCampaignAccess(campaignId, userId)
    const viewerSafe = access.access?.role === 'VIEWER'
    return { ok: true, data: toDetail(row, viewerSafe) }
  }

  async updateDungeon(
    campaignId: string,
    dungeonId: string,
    userId: string,
    input: DungeonUpdateInput,
  ): Promise<ServiceResult<CampaignDungeonDetail>> {
    const existing = await withDungeonAccess(dungeonId, campaignId, userId, 'content.write')
    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
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

    return { ok: true, data: toDetail({ ...updated, configJson: nextConfig }) }
  }

  async deleteDungeon(campaignId: string, dungeonId: string, userId: string): Promise<ServiceResult<{ deleted: true }>> {
    const existing = await withDungeonAccess(dungeonId, campaignId, userId, 'content.write')
    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
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
    return { ok: true, data: { deleted: true } }
  }

  async generateDungeon(
    campaignId: string,
    dungeonId: string,
    userId: string,
    input: DungeonGenerateInput,
  ): Promise<ServiceResult<CampaignDungeonDetail>> {
    const existing = await withDungeonAccess(dungeonId, campaignId, userId, 'content.write')
    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
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

    return { ok: true, data: toDetail({ ...updated, configJson: config, mapJson: map }) }
  }

  async regenerateDungeon(
    campaignId: string,
    dungeonId: string,
    userId: string,
    input: DungeonRegenerateInput,
  ): Promise<ServiceResult<CampaignDungeonDetail>> {
    const existing = await withDungeonAccess(dungeonId, campaignId, userId, 'content.write')
    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
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

    return { ok: true, data: toDetail({ ...updated, configJson: config, mapJson: regenerated }) }
  }

  async setPublishStatus(
    campaignId: string,
    dungeonId: string,
    userId: string,
    status: 'READY' | 'DRAFT',
  ): Promise<ServiceResult<CampaignDungeonDetail>> {
    const existing = await prisma.campaignDungeon.findFirst({
      where: {
        id: dungeonId,
        campaignId,
        campaign: buildCampaignWhereForPermission(userId, 'campaign.public.manage'),
      },
    })
    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
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
    return { ok: true, data: toDetail(updated) }
  }
}
