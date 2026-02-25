import { prisma } from '#server/db/prisma'
import { Prisma } from '#server/db/prisma-client'
import type { ServiceResult } from '#server/services/auth.service'
import { buildCampaignWhereForPermission, resolveCampaignAccess } from '#server/utils/campaign-auth'
import type { DungeonExportInput, DungeonImportInput } from '#shared/schemas/dungeon'
import type {
  DungeonExportResult,
  DungeonMapData,
  DungeonPortableDocument,
  DungeonRoomGeometry,
} from '#shared/types/dungeon'
import { parseDungeonMap, toPlayerSafeMap } from '#server/services/dungeon/dungeon-map-utils'
import sharp from 'sharp'
import PDFDocument from 'pdfkit'
import { ActivityLogService } from '#server/services/activity-log.service'

const activityLogService = new ActivityLogService()

const withDungeonAccess = async (
  campaignId: string,
  dungeonId: string,
  userId: string,
  permission: 'content.read' | 'content.write',
) =>
  prisma.campaignDungeon.findFirst({
    where: {
      id: dungeonId,
      campaignId,
      campaign: buildCampaignWhereForPermission(userId, permission),
    },
    include: {
      rooms: true,
      links: true,
    },
  })

const toSvg = (map: DungeonMapData, options: Pick<DungeonExportInput, 'includeGrid' | 'includeLabels'>) => {
  const worldWidth = map.width * map.cellSize
  const worldHeight = map.height * map.cellSize
  const pointToPixel = (value: number) => (value + 0.5) * map.cellSize
  const corridorOuterWidth = Math.max(8, Math.floor(map.cellSize * 1.05))
  const corridorInnerWidth = Math.max(5, Math.floor(map.cellSize * 0.68))
  const gridSvg = options.includeGrid
    ? `<g stroke="rgba(245, 222, 179, 0.12)" stroke-width="1">${Array.from({ length: map.width }, (_, index) =>
      `<line x1="${(index + 1) * map.cellSize}" y1="0" x2="${(index + 1) * map.cellSize}" y2="${worldHeight}" />`).join('')}
${Array.from({ length: map.height }, (_, index) =>
      `<line x1="0" y1="${(index + 1) * map.cellSize}" x2="${worldWidth}" y2="${(index + 1) * map.cellSize}" />`).join('')}</g>`
    : ''
  const corridorOuterSvg = map.corridors
    .map(
      (corridor) =>
        `<polyline points="${corridor.points
          .map((point) => `${pointToPixel(point.x)},${pointToPixel(point.y)}`)
          .join(' ')}" fill="none" stroke="#88714d" stroke-width="${corridorOuterWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="0.75" />`,
    )
    .join('\n')
  const corridorInnerSvg = map.corridors
    .map(
      (corridor) =>
        `<polyline points="${corridor.points
          .map((point) => `${pointToPixel(point.x)},${pointToPixel(point.y)}`)
          .join(' ')}" fill="none" stroke="#c6a979" stroke-width="${corridorInnerWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" />`,
    )
    .join('\n')
  const roomsSvg = map.rooms
    .map(
      (room) =>
        `<rect x="${room.x * map.cellSize}" y="${room.y * map.cellSize}" width="${room.width * map.cellSize}" height="${
          room.height * map.cellSize
        }" fill="${room.isSecret ? 'rgba(220, 38, 38, 0.18)' : 'rgba(226, 210, 178, 0.5)'}" stroke="#94a3b8" stroke-width="2" />`,
    )
    .join('\n')
  const doorsSvg = map.doors
    .map(
      (door) =>
        `<circle cx="${pointToPixel(door.x)}" cy="${pointToPixel(door.y)}" r="5" fill="${
          door.isSecret ? '#f59e0b' : door.isLocked ? '#ef4444' : '#10b981'
        }" />`,
    )
    .join('\n')
  const labelsSvg = options.includeLabels
    ? map.rooms
      .map(
        (room) =>
          `<text x="${(room.x + Math.floor(room.width / 2)) * map.cellSize}" y="${(room.y + Math.floor(room.height / 2)) * map.cellSize}" fill="#f5f0e6" font-size="12" text-anchor="middle" dominant-baseline="middle">R${room.roomNumber}</text>`,
      )
      .join('\n')
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${worldWidth}" height="${worldHeight}" viewBox="0 0 ${worldWidth} ${worldHeight}">
  <rect x="0" y="0" width="${worldWidth}" height="${worldHeight}" fill="#1f1b16"/>
  ${gridSvg}
  ${corridorOuterSvg}
  ${corridorInnerSvg}
  ${roomsSvg}
  ${doorsSvg}
  ${labelsSvg}
</svg>`
}

const toPngBase64 = async (svg: string) => {
  const buffer = await sharp(Buffer.from(svg, 'utf8')).png().toBuffer()
  return buffer.toString('base64')
}

const toPdfBase64 = async (map: DungeonMapData, svg: string) =>
  await new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 28 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')))
    doc.on('error', (error) => reject(error))

    doc.fontSize(14).text('Dungeon Export', { align: 'left' })
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

const syncRoomsFromImportedMap = async (dungeonId: string, rooms: DungeonRoomGeometry[]) => {
  await prisma.$transaction(async (tx) => {
    await tx.campaignDungeonRoom.deleteMany({ where: { dungeonId } })
    for (const room of rooms) {
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
          boundsJson: {
            x: room.x,
            y: room.y,
            width: room.width,
            height: room.height,
          },
        },
      })
    }
  })
}

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
    userId: string,
    input: DungeonExportInput,
  ): Promise<ServiceResult<DungeonExportResult>> {
    const row = await withDungeonAccess(campaignId, dungeonId, userId, 'content.read')
    if (!row) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Dungeon not found or access denied.',
      }
    }

    const map = parseDungeonMap(row.mapJson)
    const resolved = await resolveCampaignAccess(campaignId, userId)
    const forcePlayerSafe = resolved.access?.role === 'VIEWER'
    const effectivePlayerSafe = forcePlayerSafe || input.playerSafe || !input.includeGmLayer
    const exportMap = effectivePlayerSafe ? toPlayerSafeMap(map) : map
    const safeSuffix = input.playerSafe ? '-player' : '-dm'
    const baseName = row.name.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase() || 'dungeon'
    const svg = toSvg(exportMap, input)

    if (input.format === 'SVG') {
      await this.logExport(campaignId, userId, row.id, 'SVG', effectivePlayerSafe)
      return {
        ok: true,
        data: {
          format: 'SVG',
          filename: `${baseName}${safeSuffix}.svg`,
          contentType: 'image/svg+xml',
          content: svg,
          encoding: 'utf8',
        },
      }
    }

    if (input.format === 'PNG') {
      const pngBase64 = await toPngBase64(svg)
      await this.logExport(campaignId, userId, row.id, 'PNG', effectivePlayerSafe)
      return {
        ok: true,
        data: {
          format: 'PNG',
          filename: `${baseName}${safeSuffix}.png`,
          contentType: 'image/png',
          content: pngBase64,
          encoding: 'base64',
        },
      }
    }

    if (input.format === 'PDF') {
      const pdfBase64 = await toPdfBase64(exportMap, svg)
      await this.logExport(campaignId, userId, row.id, 'PDF', effectivePlayerSafe)
      return {
        ok: true,
        data: {
          format: 'PDF',
          filename: `${baseName}${safeSuffix}.pdf`,
          contentType: 'application/pdf',
          content: pdfBase64,
          encoding: 'base64',
        },
      }
    }

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
        config: row.configJson as DungeonPortableDocument['dungeon']['config'],
        map: exportMap,
        playerView: effectivePlayerSafe ? null : ((row.playerViewJson as Record<string, unknown> | null) || null),
      },
      rooms: row.rooms.map((room) => ({
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
      links: row.links.map((link) => ({
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
      ok: true,
      data: {
        format: 'JSON',
        filename: `${baseName}${safeSuffix}.json`,
        contentType: 'application/json',
        content: JSON.stringify(document, null, 2),
        encoding: 'utf8',
      },
    }
  }

  async importDungeon(
    campaignId: string,
    userId: string,
    input: DungeonImportInput,
  ): Promise<ServiceResult<{ id: string }>> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, ...buildCampaignWhereForPermission(userId, 'content.write') },
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

    const source = input.source
    const created = await prisma.campaignDungeon.create({
      data: {
        campaignId,
        name: input.nameOverride || source.dungeon.name,
        status: source.dungeon.status,
        theme: source.dungeon.theme,
        seed: source.dungeon.seed,
        gridType: source.dungeon.gridType,
        generatorVersion: source.dungeon.generatorVersion,
        configJson: source.dungeon.config as Prisma.InputJsonValue,
        mapJson: source.dungeon.map as Prisma.InputJsonValue,
        playerViewJson:
          source.dungeon.playerView === null
            ? Prisma.JsonNull
            : (source.dungeon.playerView as Prisma.InputJsonValue),
        createdByUserId: userId,
      },
      select: { id: true },
    })

    await syncRoomsFromImportedMap(created.id, source.dungeon.map.rooms)
    const importedRooms = await prisma.campaignDungeonRoom.findMany({
      where: { dungeonId: created.id },
      select: {
        id: true,
        roomNumber: true,
        boundsJson: true,
      },
    })
    const mapByRoomNumber = new Map(importedRooms.map((room) => [room.roomNumber, room.id]))
    for (const link of source.links) {
      let mappedRoomId: string | null = null
      if (link.roomId) {
        const sourceRoom = source.rooms.find((room) => room.id === link.roomId)
        if (sourceRoom) {
          mappedRoomId = mapByRoomNumber.get(sourceRoom.roomNumber) || null
        }
      }
      await prisma.campaignDungeonLink.create({
        data: {
          dungeonId: created.id,
          roomId: mappedRoomId,
          linkType: link.linkType,
          targetId: link.targetId,
        },
      })
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

    return { ok: true, data: { id: created.id } }
  }
}
