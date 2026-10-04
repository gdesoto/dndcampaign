import type { JsonValue } from '#server/db/columns'
import { apiError } from '#server/utils/http'
import { randomUUID } from 'node:crypto'
import type {
  CampaignMapFeatureType,
  CampaignMapFileKind,
  CampaignMapGlossaryLinkType,
  GlossaryType,
} from '#server/db/schema'
import { db } from '#server/db/client'
import { campaign, campaignMap, campaignMapFile, campaignMapFeature, campaignMapGlossaryLink, glossaryEntry } from '#server/db/schema'
import { eq, and, desc, asc, inArray, count, sql } from 'drizzle-orm'
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

const featureTypeFromDb = (value: CampaignMapFeatureType) => dbMapFeatureTypeToApi[value]!

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
  private async findCampaign(campaignId: string) {
    return db.query.campaign.findFirst({ where: eq(campaign.id, campaignId), columns: { id: true } }).sync()
  }

  private async findMap(campaignId: string, mapId: string) {
    return db.query.campaignMap.findFirst({ where: and(eq(campaignMap.id, mapId), eq(campaignMap.campaignId, campaignId)) }).sync()
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
      db.query.campaignMap.findFirst({ where: and(eq(campaignMap.campaignId, campaignId), eq(campaignMap.slug, slug)), columns: { id: true } }).sync()
    ) {
      index += 1
      slug = `${base}-${index}`
    }
    return slug
  }

  private buildRawStorageKey(campaignId: string, mapId: string, filename: string) {
    return `campaigns/${campaignId}/maps/${mapId}/raw/${randomUUID()}-${safeFilename(filename)}`
  }

  private toDbFeatureInput(campaignMapId: string, feature: ParsedMapFeature): typeof campaignMapFeature.$inferInsert {
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
      propertiesJson: feature.propertiesJson ?? null,
      sourceRef: feature.sourceRef,
      isActive: !feature.removed,
      removed: feature.removed,
    }
  }

  private async setPrimaryMap(campaignId: string, mapId: string) {
    db.transaction((tx) => {
      tx.update(campaignMap).set({ isPrimary: false }).where(and(eq(campaignMap.campaignId, campaignId), eq(campaignMap.isPrimary, true))).run()
      tx.update(campaignMap).set({ isPrimary: true }).where(eq(campaignMap.id, mapId)).returning().get()!
    }, { behavior: 'immediate' })
  }

  async createMapFromUpload(campaignId: string, userId: string, fields: Record<string, string>, files: UploadedMapFile[]) {
    const campaign = await this.findCampaign(campaignId)
    if (!campaign) return null

    const classified = classifyMapUploadFiles(files)
    const parsed = parseAzgaarFullJson(classified.fullJson.buffer)
    const mapName = (fields.name || '').trim() || parsed.mapName || 'Imported Map'
    const slug = await this.allocateSlug(campaignId, mapName)
    const isPrimaryRequested = boolFromField(fields.isPrimary)
    const hasPrimary = db.query.campaignMap.findFirst({ where: and(eq(campaignMap.campaignId, campaignId), eq(campaignMap.isPrimary, true)), columns: { id: true } }).sync()

    const map = db.insert(campaignMap).values({
        campaignId,
        name: mapName,
        slug,
        isPrimary: isPrimaryRequested || !hasPrimary,
        status: 'ACTIVE',
        sourceType: 'AZGAAR_FULL_JSON',
        createdById: userId,
        sourceFingerprint: parsed.sourceFingerprint,
        importVersion: 1,
        rawManifestJson: ({
          bounds: parsed.bounds,
          metadata: parsed.metadata,
          mapCoordinates: parsed.metadata.mapCoordinates,
          defaultActiveLayers: defaultMapLayerTypes,
        }) as unknown as JsonValue,
      }).returning().get()!

    if (isPrimaryRequested && hasPrimary) {
      await this.setPrimaryMap(campaignId, map.id)
    }

    const adapter = getStorageAdapter()
    const persistedFiles = [classified.fullJson, ...classified.optionalFiles]
    const fileCreates: typeof campaignMapFile.$inferInsert[] = []

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

    db.insert(campaignMapFile).values(fileCreates).run()
    if (parsed.features.length) {
      db.insert(campaignMapFeature).values(parsed.features.map((feature) => this.toDbFeatureInput(map.id, feature))).run()
    }

    const created = db.query.campaignMap.findFirst({ where: eq(campaignMap.id, map.id), with: {
        features: { columns: { featureType: true } },
        files: { columns: { kind: true } },
      } }).sync()
    return created ? toSummary(created as never) : null
  }

  async listMaps(campaignId: string) {
    const campaign = await this.findCampaign(campaignId)
    if (!campaign) return null
    const maps = db.query.campaignMap.findMany({ where: eq(campaignMap.campaignId, campaignId), with: {
        features: { columns: { featureType: true } },
        files: { columns: { kind: true } },
      }, orderBy: [desc(campaignMap.isPrimary), desc(campaignMap.updatedAt)] }).sync()
    return maps.map((entry) => toSummary(entry as never))
  }

  async updateMap(campaignId: string, mapId: string, input: { name?: string; status?: 'ACTIVE' | 'ARCHIVED'; isPrimary?: boolean }) {
    const map = await this.findMap(campaignId, mapId)
    if (!map) return null

    if (input.isPrimary) {
      await this.setPrimaryMap(campaignId, mapId)
    }

    const updateData: Partial<typeof campaignMap.$inferInsert> = {}
    if (typeof input.name === 'string') {
      updateData.name = input.name
    }
    if (input.status) {
      updateData.status = input.status
    }

    if (Object.keys(updateData).length) {
      db.update(campaignMap).set(updateData).where(eq(campaignMap.id, mapId)).returning().get()!
    }

    const updated = db.query.campaignMap.findFirst({ where: eq(campaignMap.id, mapId), with: {
        features: { columns: { featureType: true } },
        files: { columns: { kind: true } },
      } }).sync()
    return updated ? toSummary(updated as never) : null
  }

  async getMapSvg(campaignId: string, mapId: string) {
    const map = await this.findMap(campaignId, mapId)
    if (!map) return null

    const svgFile = db.query.campaignMapFile.findFirst({ where: and(eq(campaignMapFile.campaignMapId, mapId), eq(campaignMapFile.kind, 'SVG')), orderBy: [desc(campaignMapFile.createdAt)] }).sync()
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

  async deleteMap(campaignId: string, mapId: string) {
    const map = await this.findMap(campaignId, mapId)
    if (!map) return null

    const files = db.query.campaignMapFile.findMany({ where: eq(campaignMapFile.campaignMapId, mapId), columns: { storageKey: true } }).sync()
    const adapter = getStorageAdapter()

    db.transaction((tx) => {
      tx.delete(campaignMap).where(eq(campaignMap.id, mapId)).returning().get()!

      if (map.isPrimary) {
        const replacement = tx.query.campaignMap.findFirst({ where: eq(campaignMap.campaignId, campaignId), columns: { id: true }, orderBy: [desc(campaignMap.updatedAt), desc(campaignMap.createdAt)] }).sync()
        if (replacement) {
          tx.update(campaignMap).set({ isPrimary: true }).where(eq(campaignMap.id, replacement.id)).returning().get()!
        }
      }
    }, { behavior: 'immediate' })

    for (const file of files) {
      adapter.deleteObject(file.storageKey).catch(() => undefined)
    }

    return { id: mapId }
  }

  async getViewer(campaignId: string, mapId: string): Promise<CampaignMapViewerDto | null> {
    const map = await this.findMap(campaignId, mapId)
    if (!map) return null

    const features = db.query.campaignMapFeature.findMany({ where: eq(campaignMapFeature.campaignMapId, mapId), orderBy: [asc(campaignMapFeature.featureType), asc(campaignMapFeature.displayName)] }).sync()
    const glossaryLinks = db.query.campaignMapGlossaryLink.findMany({ where: eq(campaignMapGlossaryLink.campaignMapId, mapId), columns: { mapFeatureId: true } }).sync()
    const glossaryEntries = db.query.glossaryEntry.findMany({ where: eq(glossaryEntry.campaignId, map.campaignId), columns: {
        id: true,
        type: true,
        name: true,
        sourceMapFeatureId: true,
      } }).sync()

    const linkedFeatureIds = new Set(glossaryLinks.map((entry) => entry.mapFeatureId))
    const normalizedGlossary = glossaryEntries.map((entry) => ({
      ...entry,
      normalizedName: normalizeMapName(entry.name),
    }))

    const manifest = (map.rawManifestJson || {}) as Record<string, unknown>
    const bounds: [[number, number], [number, number]] =
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
      features: features.map((feature) => {
        const glossaryLinked = linkedFeatureIds.has(feature.id)
        const glossaryMatched =
          !glossaryLinked &&
          buildGlossaryConflictCandidates(normalizedGlossary, {
            id: feature.id,
            normalizedName: feature.normalizedName,
          }).length > 0

        return {
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
            glossaryLinked,
            glossaryMatched,
            glossaryLinkedOrMatched: glossaryLinked || glossaryMatched,
            ...(feature.propertiesJson as Record<string, unknown> | null | undefined),
          },
        }
      }),
    }
  }

  async getFeatures(campaignId: string, mapId: string, filter: { types?: MapFeatureType[]; includeRemoved?: boolean }) {
    const map = await this.findMap(campaignId, mapId)
    if (!map) return null

    const features = db.query.campaignMapFeature.findMany({ where: and(eq(campaignMapFeature.campaignMapId, mapId), (filter.types?.length ? inArray(campaignMapFeature.featureType, filter.types.map((entry) => mapFeatureTypeToDb[entry]!)) : undefined), (filter.includeRemoved ? undefined : eq(campaignMapFeature.removed, false))), orderBy: [asc(campaignMapFeature.featureType), asc(campaignMapFeature.displayName)] }).sync()

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

  async stageGlossary(campaignId: string, mapId: string, featureIds: string[]): Promise<MapGlossaryStageResultDto | null> {
    const map = await this.findMap(campaignId, mapId)
    if (!map) return null

    const features = db.query.campaignMapFeature.findMany({ where: and(eq(campaignMapFeature.campaignMapId, mapId), inArray(campaignMapFeature.id, featureIds)), orderBy: [asc(campaignMapFeature.displayName)] }).sync()
    const glossary = db.query.glossaryEntry.findMany({ where: eq(glossaryEntry.campaignId, campaignId), columns: {
        id: true,
        type: true,
        name: true,
        sourceMapFeatureId: true,
      } }).sync()
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
    items: Array<{
      featureId: string
      action: 'create' | 'link' | 'merge' | 'skip'
      glossaryEntryId?: string
      glossaryPayload?: { type: GlossaryType; name: string; aliases?: string; description: string }
    }>
  ): Promise<MapGlossaryCommitResultDto | null> {
    const map = await this.findMap(campaignId, mapId)
    if (!map) return null

    const counters = {
      processed: items.length,
      created: 0,
      linked: 0,
      merged: 0,
      skipped: 0,
    }

    db.transaction((tx) => {
      for (const item of items) {
        const feature = tx.query.campaignMapFeature.findFirst({ where: and(eq(campaignMapFeature.id, item.featureId), eq(campaignMapFeature.campaignMapId, mapId)) }).sync()
        if (!feature || item.action === 'skip') {
          counters.skipped += 1
          continue
        }

        const ensureLink = (glossaryEntryId: string, linkType: CampaignMapGlossaryLinkType) => {
          const existing = tx.query.campaignMapGlossaryLink.findFirst({ where: and(eq(campaignMapGlossaryLink.mapFeatureId, feature.id), eq(campaignMapGlossaryLink.glossaryEntryId, glossaryEntryId)), columns: { id: true } }).sync()
          if (!existing) {
            tx.insert(campaignMapGlossaryLink).values({
                campaignMapId: mapId,
                mapFeatureId: feature.id,
                glossaryEntryId,
                linkType,
              }).returning().get()!
          }
        }

        if (item.action === 'create') {
          const payload = item.glossaryPayload || {
            type: 'LOCATION' as GlossaryType,
            name: feature.displayName,
            description: feature.description || `${feature.displayName} imported from campaign map.`,
          }
          const created = tx.insert(glossaryEntry).values({
              campaignId,
              type: payload.type,
              name: payload.name,
              aliases: payload.aliases,
              description: payload.description,
              sourceMapId: mapId,
              sourceMapFeatureId: feature.id,
            }).returning().get()!
          ensureLink(created.id, 'LINKED')
          counters.created += 1
          continue
        }

        if (!item.glossaryEntryId) {
          counters.skipped += 1
          continue
        }

        const entry = tx.query.glossaryEntry.findFirst({ where: and(eq(glossaryEntry.id, item.glossaryEntryId), eq(glossaryEntry.campaignId, campaignId)) }).sync()
        if (!entry) {
          counters.skipped += 1
          continue
        }

        if (item.action === 'link') {
          ensureLink(entry.id, 'LINKED')
          counters.linked += 1
          continue
        }

        if (item.action === 'merge') {
          const incomingDescription =
            item.glossaryPayload?.description ||
            feature.description ||
            `${feature.displayName} imported from campaign map.`
          const mergedDescription = entry.description.includes(incomingDescription)
            ? entry.description
            : `${entry.description}\n\n${incomingDescription}`.trim()
          tx.update(glossaryEntry).set({
              aliases: mergeAliases(entry.aliases, item.glossaryPayload?.aliases),
              description: mergedDescription,
              sourceMapId: entry.sourceMapId || mapId,
              sourceMapFeatureId: entry.sourceMapFeatureId || feature.id,
            }).where(eq(glossaryEntry.id, entry.id)).returning().get()!
          ensureLink(entry.id, 'MERGED')
          counters.merged += 1
          continue
        }
      }
    }, { behavior: 'immediate' })

    return {
      mapId,
      ...counters,
    }
  }

  async previewReimport(
    campaignId: string,
    mapId: string,
    files: UploadedMapFile[]
  ): Promise<MapReimportPreviewDto | null> {
    const map = await this.findMap(campaignId, mapId)
    if (!map) return null

    const parsed = parseAzgaarFullJson(classifyMapUploadFiles(files).fullJson.buffer)
    const existing = db.query.campaignMapFeature.findMany({ where: eq(campaignMapFeature.campaignMapId, mapId), columns: {
        featureType: true,
        externalId: true,
        name: true,
        displayName: true,
        removed: true,
        geometryType: true,
      } }).sync()
    const diff = buildFeatureDiff(existing, parsed.features)
    const impactedGlossaryLinks = db.select({ count: count() }).from(campaignMapGlossaryLink).where(eq(campaignMapGlossaryLink.campaignMapId, mapId)).get()!.count

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
    const map = await this.findMap(campaignId, mapId)
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

    const preparedFiles: (typeof campaignMapFile.$inferInsert)[] = []
    let previousFiles: Array<{ id: string; storageKey: string }> = []
    try {
      for (const file of [classified.fullJson, ...classified.optionalFiles]) {
        const storageKey = this.buildRawStorageKey(campaignId, mapId, file.filename)
        // Register the distinct key before uploading so partial writes are cleaned up too.
        preparedFiles.push({ campaignMapId: mapId, kind: mapFileKindToDb(file.filename), storageProvider: 'LOCAL', storageKey, contentType: file.mimeType, sizeBytes: file.buffer.byteLength })
        const result = await adapter.putObject(storageKey, file.buffer, file.mimeType)
        Object.assign(preparedFiles.at(-1)!, { storageKey: result.storageKey, sizeBytes: result.byteSize, checksum: result.checksumSha256 || null })
      }
      db.transaction((tx) => {
        const currentMap = tx.query.campaignMap.findFirst({ where: and(eq(campaignMap.id, mapId), eq(campaignMap.campaignId, campaignId)) }).sync()
        if (!currentMap) throw apiError(404, 'NOT_FOUND', 'Map not found.')
        const previousLinks = tx.query.campaignMapGlossaryLink.findMany({
          where: eq(campaignMapGlossaryLink.campaignMapId, mapId),
          with: { mapFeature: { columns: { featureType: true, externalId: true, normalizedName: true } } },
        }).sync()
        previousFiles = tx.query.campaignMapFile.findMany({
          where: eq(campaignMapFile.campaignMapId, mapId),
          columns: { id: true, storageKey: true },
        }).sync()

        tx.delete(campaignMapGlossaryLink).where(eq(campaignMapGlossaryLink.campaignMapId, mapId)).run()
        tx.delete(campaignMapFeature).where(eq(campaignMapFeature.campaignMapId, mapId)).run()
        tx.delete(campaignMapFile).where(eq(campaignMapFile.campaignMapId, mapId)).run()

        const updated = tx.update(campaignMap).set({
          name: (mapName || '').trim() || currentMap.name,
          sourceFingerprint: parsed.sourceFingerprint,
          importVersion: sql`${campaignMap.importVersion} + 1`,
          rawManifestJson: ({
            bounds: parsed.bounds,
            metadata: parsed.metadata,
            mapCoordinates: parsed.metadata.mapCoordinates,
            defaultActiveLayers: defaultMapLayerTypes,
          }) as unknown as JsonValue,
        }).where(eq(campaignMap.id, mapId)).returning().get()!

        if (parsed.features.length) {
          tx.insert(campaignMapFeature).values(parsed.features.map((feature) => this.toDbFeatureInput(mapId, feature))).run()
        }
        tx.insert(campaignMapFile).values(preparedFiles).run()
        const newFeatures = tx.query.campaignMapFeature.findMany({
          where: eq(campaignMapFeature.campaignMapId, mapId),
          columns: { id: true, featureType: true, externalId: true, normalizedName: true },
        }).sync()
        const byExternal = new Map(newFeatures.map((entry) => [mapExternalKey(entry), entry]))
        const byName = new Map(newFeatures.map((entry) => [`${entry.featureType}:${entry.normalizedName}`, entry]))
        const linkCreates: typeof campaignMapGlossaryLink.$inferInsert[] = []
        for (const oldLink of previousLinks) {
          const externalMatch = byExternal.get(mapExternalKey(oldLink.mapFeature))
          const fallbackNameMatch = byName.get(`${oldLink.mapFeature.featureType}:${oldLink.mapFeature.normalizedName}`)
          const target = strategy === 'replace_preserve_links' ? externalMatch : externalMatch || fallbackNameMatch
          if (!target) continue
          linkCreates.push({
            campaignMapId: mapId,
            mapFeatureId: target.id,
            glossaryEntryId: oldLink.glossaryEntryId,
            linkType: oldLink.linkType,
          })
        }
        if (linkCreates.length) tx.insert(campaignMapGlossaryLink).values(linkCreates).run()
        if (keepPrimary && !updated.isPrimary) {
          tx.update(campaignMap).set({ isPrimary: false }).where(and(eq(campaignMap.campaignId, campaignId), eq(campaignMap.isPrimary, true))).run()
          tx.update(campaignMap).set({ isPrimary: true }).where(eq(campaignMap.id, mapId)).run()
        }
      }, { behavior: 'immediate' })
    } catch (error) {
      await Promise.allSettled(preparedFiles.map(file => adapter.deleteObject(file.storageKey)))
      throw error
    }
    // Cleanup only obsolete objects after commit; new references remain valid if cleanup fails.
    for (const file of previousFiles) {
      try { await adapter.deleteObject(file.storageKey) }
      catch (error) { console.warn('Map reimport committed, but an obsolete file could not be deleted.', { mapId, storageKey: file.storageKey, error }) }
    }

    const withCounts = db.query.campaignMap.findFirst({ where: eq(campaignMap.id, mapId), with: {
        features: { columns: { featureType: true } },
        files: { columns: { kind: true } },
      } }).sync()
    return withCounts ? toSummary(withCounts as never) : null
  }
}

