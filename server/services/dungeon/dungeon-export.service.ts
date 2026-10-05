import type { JsonValue } from '#server/db/columns'
import { jsonNull } from '#server/db/columns'
import { db } from '#server/db/client'
import { campaignDungeon, campaignDungeonRoom, campaignDungeonLink } from '#server/db/schema'
import { eq, and } from 'drizzle-orm'
import { dungeonMapSchema, type DungeonExportInput, type DungeonImportInput } from '#shared/schemas/dungeon'
import type {
  DungeonExportResult,
  DungeonMapData,
  DungeonPortableDocument,
} from '#shared/types/dungeon'
import { resetDungeonRooms } from '#server/services/dungeon/dungeon.service'
import { getDungeonFloorMap, toPlayerSafeDungeonConfig, toPlayerSafeMap } from '#shared/utils/dungeon-map'
import { renderDungeonSvg } from '#shared/utils/dungeon-render'
import sharp from 'sharp'
import PDFDocument from 'pdfkit'
import { ActivityLogService } from '#server/services/activity-log.service'
import { apiError } from '#server/utils/http'
import type { CampaignActor } from '#server/utils/campaign-auth'

const activityLogService = new ActivityLogService()

const withDungeonAccess = async (campaignId: string, dungeonId: string) =>
  db.query.campaignDungeon.findFirst({ where: and(eq(campaignDungeon.id, dungeonId), eq(campaignDungeon.campaignId, campaignId)), with: {
      rooms: true,
      links: true,
    } }).sync()

const toPngBase64 = async (svg: string) => {
  const buffer = await sharp(Buffer.from(svg, 'utf8')).png().toBuffer()
  return buffer.toString('base64')
}

const toPdfBase64 = async (map: DungeonMapData, svg: string, floor: number) =>
  await new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 28 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')))
    doc.on('error', (error) => reject(error))

    doc.fontSize(14).text(`Encounter Map — ${map.floorLabels?.[floor] || `Floor ${floor + 1}`}`, { align: 'left' })
    doc.moveDown(0.4)
    doc.fontSize(10).text(`Seed: ${map.metadata.seed}`)
    doc.text(`Generated: ${new Date(map.metadata.generatedAt).toLocaleString()}`)
    doc.text(`Rooms: ${map.rooms.length}  Corridors: ${map.corridors.length}  Doors: ${map.doors.length}`)
    doc.moveDown(0.6)

    sharp(Buffer.from(svg, 'utf8'))
      .png()
      .toBuffer()
      .then((pngBuffer) => {
        const maxWidth = 540
        const maxHeight = 640
        doc.image(pngBuffer, 28, doc.y, {
          fit: [maxWidth, maxHeight],
          align: 'center',
        })
        doc.end()
      })
      .catch(reject)
  })

export class DungeonExportService {
  private async logExport(
    campaignId: string,
    userId: string,
    dungeonId: string,
    format: DungeonExportResult['format'],
    playerSafe: boolean,
  ) {
    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_EXPORTED',
      targetType: 'DUNGEON',
      targetId: dungeonId,
      summary: `Exported dungeon as ${format}.`,
      metadata: { format, playerSafe },
    })
  }

  async exportDungeon(
    campaignId: string,
    dungeonId: string,
    actor: CampaignActor,
    input: DungeonExportInput,
  ): Promise<DungeonExportResult> {
    const userId = actor.userId
    const row = await withDungeonAccess(campaignId, dungeonId)
    if (!row) {
      throw apiError(404, 'NOT_FOUND', 'Dungeon not found or access denied.')
    }

    const map = dungeonMapSchema.parse(row.mapJson)
    const forcePlayerSafe = actor.access.role === 'VIEWER'
    const effectivePlayerSafe = forcePlayerSafe || input.playerSafe || !input.includeGmLayer
    const exportMap = effectivePlayerSafe ? toPlayerSafeMap(map) : map
    const safeSuffix = effectivePlayerSafe ? '-player' : '-dm'
    const baseName = row.name.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase() || 'dungeon'
    const floor = input.floor ?? 0
    if (input.format !== 'JSON' && floor >= (map.floorCount ?? 1)) {
      throw apiError(400, 'INVALID_FLOOR', 'The selected floor does not exist on this map.')
    }
    const floorSuffix = (map.floorCount ?? 1) > 1 ? `-floor-${floor + 1}` : ''
    const svg = input.format === 'JSON' ? '' : `<?xml version="1.0" encoding="UTF-8"?>\n${renderDungeonSvg(exportMap, input)}`

    if (input.format === 'SVG') {
      await this.logExport(campaignId, userId, row.id, 'SVG', effectivePlayerSafe)
      return {
          format: 'SVG',
          filename: `${baseName}${floorSuffix}${safeSuffix}.svg`,
          contentType: 'image/svg+xml',
          content: svg,
          encoding: 'utf8',
        }
    }

    if (input.format === 'PNG') {
      const pngBase64 = await toPngBase64(svg)
      await this.logExport(campaignId, userId, row.id, 'PNG', effectivePlayerSafe)
      return {
          format: 'PNG',
          filename: `${baseName}${floorSuffix}${safeSuffix}.png`,
          contentType: 'image/png',
          content: pngBase64,
          encoding: 'base64',
        }
    }

    if (input.format === 'PDF') {
      const pdfBase64 = await toPdfBase64(getDungeonFloorMap(exportMap, floor), svg, floor)
      await this.logExport(campaignId, userId, row.id, 'PDF', effectivePlayerSafe)
      return {
          format: 'PDF',
          filename: `${baseName}${floorSuffix}${safeSuffix}.pdf`,
          contentType: 'application/pdf',
          content: pdfBase64,
          encoding: 'base64',
        }
    }

    const visibleNumbers = new Set(exportMap.rooms.map(room => room.roomNumber))
    const exportRooms = effectivePlayerSafe ? row.rooms.filter(room => visibleNumbers.has(room.roomNumber)) : row.rooms
    const visibleRoomIds = new Set(exportRooms.map(room => room.id))
    const config = row.configJson as DungeonPortableDocument['dungeon']['config']
    const document: DungeonPortableDocument = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: {
        dungeonId: row.id,
        campaignId: row.campaignId,
      },
      dungeon: {
        name: row.name,
        status: row.status,
        theme: row.theme,
        seed: row.seed,
        gridType: row.gridType,
        generatorVersion: row.generatorVersion,
        config: effectivePlayerSafe ? toPlayerSafeDungeonConfig(config) : config,
        map: exportMap,
        playerView: effectivePlayerSafe ? null : ((row.playerViewJson as Record<string, unknown> | null) || null),
      },
      rooms: exportRooms.map((room) => ({
        id: room.id,
        dungeonId: room.dungeonId,
        roomNumber: room.roomNumber,
        name: room.name,
        description: room.description,
        gmNotes: effectivePlayerSafe ? null : room.gmNotes,
        playerNotes: room.playerNotes,
        readAloud: room.readAloud,
        tags: ((room.tagsJson as string[]) || []).filter(Boolean),
        bounds: (room.boundsJson as { x: number; y: number; width: number; height: number } | null) || null,
        state: room.state,
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString(),
      })),
      links: row.links.filter(link => !effectivePlayerSafe || !link.roomId || visibleRoomIds.has(link.roomId)).map((link) => ({
        id: link.id,
        dungeonId: link.dungeonId,
        roomId: link.roomId,
        linkType: link.linkType,
        targetId: link.targetId,
        createdAt: link.createdAt.toISOString(),
      })),
    }

    await this.logExport(campaignId, userId, row.id, 'JSON', effectivePlayerSafe)
    return {
        format: 'JSON',
        filename: `${baseName}${safeSuffix}.json`,
        contentType: 'application/json',
        content: JSON.stringify(document, null, 2),
        encoding: 'utf8',
      }
  }

  async importDungeon(
    campaignId: string,
    actor: CampaignActor,
    input: DungeonImportInput,
  ): Promise<{ id: string }> {
    const userId = actor.userId
    const source = input.source
    const created = db.insert(campaignDungeon).values({
        campaignId,
        name: input.nameOverride || source.dungeon.name,
        status: source.dungeon.status,
        theme: source.dungeon.theme,
        seed: source.dungeon.seed,
        gridType: source.dungeon.gridType,
        generatorVersion: source.dungeon.generatorVersion,
        configJson: (source.dungeon.config) as unknown as JsonValue,
        mapJson: (source.dungeon.map) as unknown as JsonValue,
        playerViewJson:
          source.dungeon.playerView === null
            ? jsonNull
            : (source.dungeon.playerView as unknown as JsonValue),
        createdByUserId: userId,
      }).returning().get()!

    resetDungeonRooms(created.id, source.dungeon.map.rooms)
    const importedRooms = db.query.campaignDungeonRoom.findMany({ where: eq(campaignDungeonRoom.dungeonId, created.id), columns: {
        id: true,
        roomNumber: true,
        boundsJson: true,
      } }).sync()
    const mapByRoomNumber = new Map(importedRooms.map((room) => [room.roomNumber, room.id]))
    for (const link of source.links) {
      let mappedRoomId: string | null = null
      if (link.roomId) {
        const sourceRoom = source.rooms.find((room) => room.id === link.roomId)
        if (sourceRoom) {
          mappedRoomId = mapByRoomNumber.get(sourceRoom.roomNumber) || null
        }
      }
      db.insert(campaignDungeonLink).values({
          dungeonId: created.id,
          roomId: mappedRoomId,
          linkType: link.linkType,
          targetId: link.targetId,
        }).returning().get()!
    }

    await activityLogService.log({
      actorUserId: userId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'DUNGEON_IMPORTED',
      targetType: 'DUNGEON',
      targetId: created.id,
      summary: `Imported dungeon "${input.nameOverride || source.dungeon.name}".`,
    })

    return { id: created.id }
  }
}
