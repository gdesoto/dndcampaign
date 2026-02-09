import { randomUUID } from 'node:crypto'
import type {
  CampaignMapFeatureType,
  CampaignMapFileKind,
  CampaignMapGlossaryLinkType,
  GlossaryType,
  Prisma,
} from '@prisma/client'
import { prisma } from '#server/db/prisma'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import {
  buildFeatureDiff,
  classifyMapUploadFiles,
  normalizeMapName,
  parseAzgaarFullJson,
  type ParsedMapFeature,
  type UploadedMapFile,
} from './map-parser.service'
import { buildGlossaryConflictCandidates } from './map-conflict.utils'
import { defaultMapLayerTypes, type MapFeatureType } from '#shared/schemas/map'
import type {
  CampaignMapSummaryDto,
  CampaignMapViewerDto,
  MapGlossaryCommitResultDto,
  MapGlossaryStageResultDto,
  MapReimportPreviewDto,
  MapReimportStrategy,
} from '#shared/types/api/map'

const mapFeatureTypeToDb: Record<MapFeatureType, CampaignMapFeatureType> = {
  state: 'STATE',
  province: 'PROVINCE',
  burg: 'BURG',
  marker: 'MARKER',
  river: 'RIVER',
  route: 'ROUTE',
  cell: 'CELL',
}

const dbMapFeatureTypeToApi: Record<CampaignMapFeatureType, MapFeatureType> = {
  STATE: 'state',
  PROVINCE: 'province',
  BURG: 'burg',
  MARKER: 'marker',
  RIVER: 'river',
  ROUTE: 'route',
  CELL: 'cell',
}

const mapFileKindToDb = (filename: string): CampaignMapFileKind => {
  const lowered = filename.toLowerCase()
  if (lowered.endsWith('.svg')) return 'SVG'
  if (lowered.endsWith('.geojson') && lowered.includes('marker')) return 'GEOJSON_MARKERS'
  if (lowered.endsWith('.geojson') && lowered.includes('river')) return 'GEOJSON_RIVERS'
  if (lowered.endsWith('.geojson') && lowered.includes('route')) return 'GEOJSON_ROUTES'
  if (lowered.endsWith('.geojson') && lowered.includes('cell')) return 'GEOJSON_CELLS'
  return 'FULL_JSON'
}

const boolFromField = (value: string | undefined) =>
  value === '1' || value === 'true' || value === 'TRUE' || value === 'yes'

const safeFilename = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_')

const featureTypeFromDb = (value: CampaignMapFeatureType) => dbMapFeatureTypeToApi[value]

const parseMapCoordinates = (value: unknown): CampaignMapViewerDto['map']['mapCoordinates'] | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const entry = value as Record<string, unknown>
  const latT = typeof entry.latT === 'number' && Number.isFinite(entry.latT) ? entry.latT : null
  const latN = typeof entry.latN === 'number' && Number.isFinite(entry.latN) ? entry.latN : null
  const latS = typeof entry.latS === 'number' && Number.isFinite(entry.latS) ? entry.latS : null
  const lonT = typeof entry.lonT === 'number' && Number.isFinite(entry.lonT) ? entry.lonT : null
  const lonW = typeof entry.lonW === 'number' && Number.isFinite(entry.lonW) ? entry.lonW : null
  const lonE = typeof entry.lonE === 'number' && Number.isFinite(entry.lonE) ? entry.lonE : null
  if (
    latT === null ||
    latN === null ||
    latS === null ||
    lonT === null ||
    lonW === null ||
    lonE === null
  ) {
    return undefined
  }
  return { latT, latN, latS, lonT, lonW, lonE }
}

const toSummary = (map: {
  id: string
  campaignId: string
  name: string
  slug: string
  isPrimary: boolean
  status: 'ACTIVE' | 'ARCHIVED'
  sourceType: 'AZGAAR_FULL_JSON'
  importVersion: number
  sourceFingerprint: string
  files: Array<{ kind: CampaignMapFileKind }>
  createdAt: Date
  updatedAt: Date
  features: Array<{ featureType: CampaignMapFeatureType }>
}): CampaignMapSummaryDto => {
  const featureCounts: CampaignMapSummaryDto['featureCounts'] = {
    state: 0,
    province: 0,
    burg: 0,
    marker: 0,
    river: 0,
    route: 0,
    cell: 0,
  }
  for (const feature of map.features) {
    featureCounts[featureTypeFromDb(feature.featureType)] += 1
  }
  return {
    id: map.id,
    campaignId: map.campaignId,
    name: map.name,
    slug: map.slug,
    isPrimary: map.isPrimary,
    status: map.status,
    sourceType: map.sourceType,
    importVersion: map.importVersion,
    sourceFingerprint: map.sourceFingerprint,
    hasSvg: map.files.some((entry) => entry.kind === 'SVG'),
    createdAt: map.createdAt.toISOString(),
    updatedAt: map.updatedAt.toISOString(),
    featureCounts,
  }
}

const mapExternalKey = (entry: { featureType: CampaignMapFeatureType; externalId: string }) =>
  `${entry.featureType}:${entry.externalId}`

const mergeAliases = (current: string | null, incoming?: string) => {
  const set = new Set(
    `${current || ''},${incoming || ''}`
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  )
  return set.size ? [...set].join(', ') : null
}

export class MapService {
  private async ensureCampaignOwner(campaignId: string, userId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, ownerId: userId },
      select: { id: true },
    })
    return campaign
  }

  private async ensureMapOwnership(campaignId: string, mapId: string, userId: string) {
    const map = await prisma.campaignMap.findFirst({
      where: {
        id: mapId,
        campaignId,
        campaign: { ownerId: userId },
      },
    })
    return map
  }

  private async allocateSlug(campaignId: string, preferred: string) {
    const base = preferred
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'map'
    let slug = base
    let index = 1
    while (
      await prisma.campaignMap.findFirst({
        where: { campaignId, slug },
        select: { id: true },
      })
    ) {
      index += 1
      slug = `${base}-${index}`
    }
    return slug
  }

  private buildRawStorageKey(campaignId: string, mapId: string, filename: string) {
    return `campaigns/${campaignId}/maps/${mapId}/raw/${randomUUID()}-${safeFilename(filename)}`
  }

  private toDbFeatureInput(campaignMapId: string, feature: ParsedMapFeature): Prisma.CampaignMapFeatureCreateManyInput {
    return {
      campaignMapId,
      externalId: feature.externalId,
      featureType: mapFeatureTypeToDb[feature.featureType],
      name: feature.name,
      displayName: feature.displayName,
      normalizedName: feature.normalizedName,
      description: feature.description || null,
      geometryType: feature.geometryType,
      geometryJson: feature.geometryJson,
      propertiesJson: feature.propertiesJson || null,
      sourceRef: feature.sourceRef,
      isActive: !feature.removed,
      removed: feature.removed,
    }
  }

  private async setPrimaryMap(campaignId: string, mapId: string) {
    await prisma.$transaction(async (tx) => {
      await tx.campaignMap.updateMany({
        where: { campaignId, isPrimary: true },
        data: { isPrimary: false },
      })
      await tx.campaignMap.update({
        where: { id: mapId },
        data: { isPrimary: true },
      })
    })
  }

  async createMapFromUpload(campaignId: string, userId: string, fields: Record<string, string>, files: UploadedMapFile[]) {
    const campaign = await this.ensureCampaignOwner(campaignId, userId)
    if (!campaign) return null

    const classified = classifyMapUploadFiles(files)
    const parsed = parseAzgaarFullJson(classified.fullJson.buffer)
    const mapName = (fields.name || '').trim() || parsed.mapName || 'Imported Map'
    const slug = await this.allocateSlug(campaignId, mapName)
    const isPrimaryRequested = boolFromField(fields.isPrimary)
    const hasPrimary = await prisma.campaignMap.findFirst({
      where: { campaignId, isPrimary: true },
      select: { id: true },
    })

    const map = await prisma.campaignMap.create({
      data: {
        campaignId,
        name: mapName,
        slug,
        isPrimary: isPrimaryRequested || !hasPrimary,
        status: 'ACTIVE',
        sourceType: 'AZGAAR_FULL_JSON',
        createdById: userId,
        sourceFingerprint: parsed.sourceFingerprint,
        importVersion: 1,
        rawManifestJson: {
          bounds: parsed.bounds,
          metadata: parsed.metadata,
          mapCoordinates: parsed.metadata.mapCoordinates,
          defaultActiveLayers: defaultMapLayerTypes,
        },
      },
    })

    if (isPrimaryRequested && hasPrimary) {
      await this.setPrimaryMap(campaignId, map.id)
    }

    const adapter = getStorageAdapter()
    const persistedFiles = [classified.fullJson, ...classified.optionalFiles]
    const fileCreates: Prisma.CampaignMapFileCreateManyInput[] = []

    for (const file of persistedFiles) {
      const storageKey = this.buildRawStorageKey(campaignId, map.id, file.filename)
      const result = await adapter.putObject(storageKey, file.buffer, file.mimeType)
      fileCreates.push({
        campaignMapId: map.id,
        kind: mapFileKindToDb(file.filename),
        storageProvider: 'LOCAL',
        storageKey: result.storageKey,
        contentType: file.mimeType,
        sizeBytes: result.byteSize,
        checksum: result.checksumSha256 || null,
      })
    }

    await prisma.campaignMapFile.createMany({ data: fileCreates })
    await prisma.campaignMapFeature.createMany({
      data: parsed.features.map((feature) => this.toDbFeatureInput(map.id, feature)),
    })

    const created = await prisma.campaignMap.findUnique({
      where: { id: map.id },
      include: {
        features: { select: { featureType: true } },
        files: { select: { kind: true } },
      },
    })
    return created ? toSummary(created as never) : null
  }

  async listMaps(campaignId: string, userId: string) {
    const campaign = await this.ensureCampaignOwner(campaignId, userId)
    if (!campaign) return null
    const maps = await prisma.campaignMap.findMany({
      where: { campaignId },
      include: {
        features: { select: { featureType: true } },
        files: { select: { kind: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
    })
    return maps.map((entry) => toSummary(entry as never))
  }

  async updateMap(campaignId: string, mapId: string, userId: string, input: { name?: string; status?: 'ACTIVE' | 'ARCHIVED'; isPrimary?: boolean }) {
    const map = await this.ensureMapOwnership(campaignId, mapId, userId)
    if (!map) return null

    if (input.isPrimary) {
      await this.setPrimaryMap(campaignId, mapId)
    }

    const updateData: Prisma.CampaignMapUpdateInput = {}
    if (typeof input.name === 'string') {
      updateData.name = input.name
    }
    if (input.status) {
      updateData.status = input.status
    }

    if (Object.keys(updateData).length) {
      await prisma.campaignMap.update({
        where: { id: mapId },
        data: updateData,
      })
    }

    const updated = await prisma.campaignMap.findUnique({
      where: { id: mapId },
      include: {
        features: { select: { featureType: true } },
        files: { select: { kind: true } },
      },
    })
    return updated ? toSummary(updated as never) : null
  }

  async getMapSvg(campaignId: string, mapId: string, userId: string) {
    const map = await this.ensureMapOwnership(campaignId, mapId, userId)
    if (!map) return null

    const svgFile = await prisma.campaignMapFile.findFirst({
      where: { campaignMapId: mapId, kind: 'SVG' },
      orderBy: { createdAt: 'desc' },
    })
    if (!svgFile) return { missing: true as const }

    const adapter = getStorageAdapter()
    const stream = await adapter.getObject(svgFile.storageKey)
    return {
      missing: false as const,
      contentType: svgFile.contentType || 'image/svg+xml',
      filename: `${map.slug || 'map'}.svg`,
      stream,
    }
  }

  async deleteMap(campaignId: string, mapId: string, userId: string) {
    const map = await this.ensureMapOwnership(campaignId, mapId, userId)
    if (!map) return null

    const files = await prisma.campaignMapFile.findMany({
      where: { campaignMapId: mapId },
      select: { storageKey: true },
    })
    const adapter = getStorageAdapter()

    await prisma.$transaction(async (tx) => {
      await tx.campaignMap.delete({
        where: { id: mapId },
      })

      if (map.isPrimary) {
        const replacement = await tx.campaignMap.findFirst({
          where: { campaignId },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: { id: true },
        })
        if (replacement) {
          await tx.campaignMap.update({
            where: { id: replacement.id },
            data: { isPrimary: true },
          })
        }
      }
    })

    for (const file of files) {
      adapter.deleteObject(file.storageKey).catch(() => undefined)
    }

    return { id: mapId }
  }

  async getViewer(campaignId: string, mapId: string, userId: string): Promise<CampaignMapViewerDto | null> {
    const map = await this.ensureMapOwnership(campaignId, mapId, userId)
    if (!map) return null

    const features = await prisma.campaignMapFeature.findMany({
      where: { campaignMapId: mapId },
      orderBy: [{ featureType: 'asc' }, { displayName: 'asc' }],
    })

    const manifest = (map.rawManifestJson || {}) as Record<string, unknown>
    const bounds =
      Array.isArray(manifest.bounds) && manifest.bounds.length === 2
        ? (manifest.bounds as [[number, number], [number, number]])
        : [[-180, -85], [180, 85]]
    const mapCoordinates = parseMapCoordinates(manifest.mapCoordinates)

    return {
      map: {
        id: map.id,
        campaignId: map.campaignId,
        name: map.name,
        isPrimary: map.isPrimary,
        status: map.status,
        importVersion: map.importVersion,
        sourceFingerprint: map.sourceFingerprint,
        bounds,
        mapCoordinates,
        defaultActiveLayers: [...defaultMapLayerTypes],
      },
      features: features.map((feature) => ({
        id: feature.id,
        type: 'Feature',
        geometry: feature.geometryJson as { type: string; coordinates: unknown },
        properties: {
          mapFeatureId: feature.id,
          featureType: featureTypeFromDb(feature.featureType),
          displayName: feature.displayName,
          description: feature.description,
          externalId: feature.externalId,
          removed: feature.removed,
          sourceRef: feature.sourceRef,
          ...(feature.propertiesJson as Record<string, unknown> | null | undefined),
        },
      })),
    }
  }

  async getFeatures(campaignId: string, mapId: string, userId: string, filter: { types?: MapFeatureType[]; includeRemoved?: boolean }) {
    const map = await this.ensureMapOwnership(campaignId, mapId, userId)
    if (!map) return null

    const features = await prisma.campaignMapFeature.findMany({
      where: {
        campaignMapId: mapId,
        ...(filter.types?.length
          ? {
              featureType: {
                in: filter.types.map((entry) => mapFeatureTypeToDb[entry]),
              },
            }
          : {}),
        ...(filter.includeRemoved ? {} : { removed: false }),
      },
      orderBy: [{ featureType: 'asc' }, { displayName: 'asc' }],
    })

    return features.map((feature) => ({
      id: feature.id,
      featureType: featureTypeFromDb(feature.featureType),
      name: feature.name,
      displayName: feature.displayName,
      description: feature.description,
      removed: feature.removed,
      geometryType: feature.geometryType,
      sourceRef: feature.sourceRef,
      geometry: feature.geometryJson,
      properties: feature.propertiesJson,
    }))
  }

  async stageGlossary(campaignId: string, mapId: string, userId: string, featureIds: string[]): Promise<MapGlossaryStageResultDto | null> {
    const map = await this.ensureMapOwnership(campaignId, mapId, userId)
    if (!map) return null

    const features = await prisma.campaignMapFeature.findMany({
      where: { campaignMapId: mapId, id: { in: featureIds } },
      orderBy: { displayName: 'asc' },
    })
    const glossary = await prisma.glossaryEntry.findMany({
      where: { campaignId },
      select: {
        id: true,
        type: true,
        name: true,
        sourceMapFeatureId: true,
      },
    })
    const normalizedGlossary = glossary.map((entry) => ({
      ...entry,
      normalizedName: normalizeMapName(entry.name),
    }))

    return {
      mapId,
      stagedAt: new Date().toISOString(),
      items: features.map((feature) => {
        const candidates = buildGlossaryConflictCandidates(normalizedGlossary, {
          id: feature.id,
          normalizedName: feature.normalizedName,
        })
        return {
          featureId: feature.id,
          featureName: feature.displayName,
          featureType: featureTypeFromDb(feature.featureType),
          suggestedGlossary: {
            type: 'LOCATION' as const,
            name: feature.displayName,
            description: feature.description || `${feature.displayName} imported from campaign map.`,
          },
          defaultAction: candidates.length ? 'link' : 'create',
          hasConflict: candidates.length > 0,
          conflictCandidates: candidates,
        }
      }),
    }
  }

  async commitGlossary(
    campaignId: string,
    mapId: string,
    userId: string,
    items: Array<{
      featureId: string
      action: 'create' | 'link' | 'merge' | 'skip'
      glossaryEntryId?: string
      glossaryPayload?: { type: GlossaryType; name: string; aliases?: string; description: string }
    }>
  ): Promise<MapGlossaryCommitResultDto | null> {
    const map = await this.ensureMapOwnership(campaignId, mapId, userId)
    if (!map) return null

    const counters = {
      processed: items.length,
      created: 0,
      linked: 0,
      merged: 0,
      skipped: 0,
    }

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const feature = await tx.campaignMapFeature.findFirst({
          where: { id: item.featureId, campaignMapId: mapId },
        })
        if (!feature || item.action === 'skip') {
          counters.skipped += 1
          continue
        }

        const ensureLink = async (glossaryEntryId: string, linkType: CampaignMapGlossaryLinkType) => {
          const existing = await tx.campaignMapGlossaryLink.findFirst({
            where: { mapFeatureId: feature.id, glossaryEntryId },
            select: { id: true },
          })
          if (!existing) {
            await tx.campaignMapGlossaryLink.create({
              data: {
                campaignMapId: mapId,
                mapFeatureId: feature.id,
                glossaryEntryId,
                linkType,
              },
            })
          }
        }

        if (item.action === 'create') {
          const payload = item.glossaryPayload || {
            type: 'LOCATION' as GlossaryType,
            name: feature.displayName,
            description: feature.description || `${feature.displayName} imported from campaign map.`,
          }
          const created = await tx.glossaryEntry.create({
            data: {
              campaignId,
              type: payload.type,
              name: payload.name,
              aliases: payload.aliases,
              description: payload.description,
              sourceMapId: mapId,
              sourceMapFeatureId: feature.id,
            },
          })
          await ensureLink(created.id, 'LINKED')
          counters.created += 1
          continue
        }

        if (!item.glossaryEntryId) {
          counters.skipped += 1
          continue
        }

        const glossaryEntry = await tx.glossaryEntry.findFirst({
          where: { id: item.glossaryEntryId, campaignId },
        })
        if (!glossaryEntry) {
          counters.skipped += 1
          continue
        }

        if (item.action === 'link') {
          await ensureLink(glossaryEntry.id, 'LINKED')
          counters.linked += 1
          continue
        }

        if (item.action === 'merge') {
          const incomingDescription =
            item.glossaryPayload?.description ||
            feature.description ||
            `${feature.displayName} imported from campaign map.`
          const mergedDescription = glossaryEntry.description.includes(incomingDescription)
            ? glossaryEntry.description
            : `${glossaryEntry.description}\n\n${incomingDescription}`.trim()
          await tx.glossaryEntry.update({
            where: { id: glossaryEntry.id },
            data: {
              aliases: mergeAliases(glossaryEntry.aliases, item.glossaryPayload?.aliases),
              description: mergedDescription,
              sourceMapId: glossaryEntry.sourceMapId || mapId,
              sourceMapFeatureId: glossaryEntry.sourceMapFeatureId || feature.id,
            },
          })
          await ensureLink(glossaryEntry.id, 'MERGED')
          counters.merged += 1
          continue
        }
      }
    })

    return {
      mapId,
      ...counters,
    }
  }

  async previewReimport(
    campaignId: string,
    mapId: string,
    userId: string,
    files: UploadedMapFile[]
  ): Promise<MapReimportPreviewDto | null> {
    const map = await this.ensureMapOwnership(campaignId, mapId, userId)
    if (!map) return null

    const parsed = parseAzgaarFullJson(classifyMapUploadFiles(files).fullJson.buffer)
    const existing = await prisma.campaignMapFeature.findMany({
      where: { campaignMapId: mapId },
      select: {
        featureType: true,
        externalId: true,
        name: true,
        displayName: true,
        removed: true,
        geometryType: true,
      },
    })
    const diff = buildFeatureDiff(existing, parsed.features)
    const impactedGlossaryLinks = await prisma.campaignMapGlossaryLink.count({
      where: { campaignMapId: mapId },
    })

    return {
      mapId: map.id,
      mapName: map.name,
      diff: {
        ...diff,
        impactedGlossaryLinks,
      },
      availableStrategies: [
        'replace_preserve_links',
        'replace_relink_by_name',
        'create_new_map',
      ],
    }
  }

  async applyReimport(
    campaignId: string,
    mapId: string,
    userId: string,
    strategy: MapReimportStrategy,
    files: UploadedMapFile[],
    mapName?: string,
    keepPrimary = false
  ) {
    const map = await this.ensureMapOwnership(campaignId, mapId, userId)
    if (!map) return null

    if (strategy === 'create_new_map') {
      return this.createMapFromUpload(
        campaignId,
        userId,
        {
          name: mapName || `${map.name} (Reimport)`,
          isPrimary: keepPrimary ? 'true' : 'false',
        },
        files
      )
    }

    const classified = classifyMapUploadFiles(files)
    const parsed = parseAzgaarFullJson(classified.fullJson.buffer)
    const adapter = getStorageAdapter()

    const previousLinks = await prisma.campaignMapGlossaryLink.findMany({
      where: { campaignMapId: mapId },
      include: {
        mapFeature: {
          select: {
            featureType: true,
            externalId: true,
            normalizedName: true,
          },
        },
      },
    })
    const previousFiles = await prisma.campaignMapFile.findMany({
      where: { campaignMapId: mapId },
      select: { id: true, storageKey: true },
    })

    const updatedMap = await prisma.$transaction(async (tx) => {
      await tx.campaignMapGlossaryLink.deleteMany({
        where: { campaignMapId: mapId },
      })
      await tx.campaignMapFeature.deleteMany({
        where: { campaignMapId: mapId },
      })
      await tx.campaignMapFile.deleteMany({
        where: { campaignMapId: mapId },
      })

      const updated = await tx.campaignMap.update({
        where: { id: mapId },
        data: {
          name: (mapName || '').trim() || map.name,
          sourceFingerprint: parsed.sourceFingerprint,
          importVersion: { increment: 1 },
          rawManifestJson: {
            bounds: parsed.bounds,
            metadata: parsed.metadata,
            mapCoordinates: parsed.metadata.mapCoordinates,
            defaultActiveLayers: defaultMapLayerTypes,
          },
        },
      })

      await tx.campaignMapFeature.createMany({
        data: parsed.features.map((feature) => this.toDbFeatureInput(mapId, feature)),
      })

      const persistedFiles = [classified.fullJson, ...classified.optionalFiles]
      for (const file of persistedFiles) {
        const storageKey = this.buildRawStorageKey(campaignId, mapId, file.filename)
        const result = await adapter.putObject(storageKey, file.buffer, file.mimeType)
        await tx.campaignMapFile.create({
          data: {
            campaignMapId: mapId,
            kind: mapFileKindToDb(file.filename),
            storageProvider: 'LOCAL',
            storageKey: result.storageKey,
            contentType: file.mimeType,
            sizeBytes: result.byteSize,
            checksum: result.checksumSha256 || null,
          },
        })
      }

      return updated
    })

    for (const file of previousFiles) {
      adapter.deleteObject(file.storageKey).catch(() => undefined)
    }

    const newFeatures = await prisma.campaignMapFeature.findMany({
      where: { campaignMapId: mapId },
      select: {
        id: true,
        featureType: true,
        externalId: true,
        normalizedName: true,
      },
    })
    const byExternal = new Map(newFeatures.map((entry) => [mapExternalKey(entry), entry]))
    const byName = new Map(
      newFeatures.map((entry) => [`${entry.featureType}:${entry.normalizedName}`, entry])
    )

    const linkCreates: Prisma.CampaignMapGlossaryLinkCreateManyInput[] = []
    for (const oldLink of previousLinks) {
      const externalMatch = byExternal.get(mapExternalKey(oldLink.mapFeature))
      const fallbackNameMatch = byName.get(
        `${oldLink.mapFeature.featureType}:${oldLink.mapFeature.normalizedName}`
      )
      const target =
        strategy === 'replace_preserve_links'
          ? externalMatch
          : externalMatch || fallbackNameMatch
      if (!target) continue
      linkCreates.push({
        campaignMapId: mapId,
        mapFeatureId: target.id,
        glossaryEntryId: oldLink.glossaryEntryId,
        linkType: oldLink.linkType,
      })
    }

    if (linkCreates.length) {
      await prisma.campaignMapGlossaryLink.createMany({
        data: linkCreates,
        skipDuplicates: true,
      })
    }

    if (keepPrimary && !updatedMap.isPrimary) {
      await this.setPrimaryMap(campaignId, mapId)
    }

    const withCounts = await prisma.campaignMap.findUnique({
      where: { id: mapId },
      include: {
        features: { select: { featureType: true } },
        files: { select: { kind: true } },
      },
    })
    return withCounts ? toSummary(withCounts as never) : null
  }
}
