import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { MapFeatureType } from '#shared/types/api/map'

export type UploadedMapFile = {
  filename: string
  mimeType: string
  buffer: Buffer
}

export type ClassifiedMapUpload = {
  fullJson: UploadedMapFile
  optionalFiles: Array<UploadedMapFile & { kind: 'SVG' | 'GEOJSON_MARKERS' | 'GEOJSON_RIVERS' | 'GEOJSON_ROUTES' | 'GEOJSON_CELLS' }>
}

export type ParsedMapFeature = {
  externalId: string
  featureType: MapFeatureType
  name: string
  displayName: string
  normalizedName: string
  description?: string
  geometryType: string
  geometryJson: Prisma.InputJsonValue
  propertiesJson?: Prisma.InputJsonValue
  sourceRef: string
  removed: boolean
}

export type ParsedAzgaarMap = {
  features: ParsedMapFeature[]
  sourceFingerprint: string
  bounds: [[number, number], [number, number]]
  mapName?: string
  metadata: Record<string, unknown>
}

type AzgaarEntity = Record<string, unknown>

const round = (value: number) => Number(value.toFixed(6))

export const normalizeMapName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const stripLoneSurrogates = (value: string) =>
  value
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')

const sanitizeJsonValue = (value: unknown): Prisma.InputJsonValue => {
  if (value === null) return null
  if (typeof value === 'string') return stripLoneSurrogates(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonValue(entry))
  }
  if (isObject(value)) {
    const out: Record<string, Prisma.InputJsonValue> = {}
    for (const [key, entry] of Object.entries(value)) {
      out[key] = sanitizeJsonValue(entry)
    }
    return out
  }
  return stripLoneSurrogates(String(value))
}

const getNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const getArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

const getString = (value: unknown) => (typeof value === 'string' ? value : '')

const getFeatureTypeFromKind = (kind: string): 'SVG' | 'GEOJSON_MARKERS' | 'GEOJSON_RIVERS' | 'GEOJSON_ROUTES' | 'GEOJSON_CELLS' | null => {
  if (kind.endsWith('.svg')) return 'SVG'
  if (kind.endsWith('.geojson') && kind.includes('marker')) return 'GEOJSON_MARKERS'
  if (kind.endsWith('.geojson') && kind.includes('river')) return 'GEOJSON_RIVERS'
  if (kind.endsWith('.geojson') && kind.includes('route')) return 'GEOJSON_ROUTES'
  if (kind.endsWith('.geojson') && kind.includes('cell')) return 'GEOJSON_CELLS'
  return null
}

export const classifyMapUploadFiles = (files: UploadedMapFile[]): ClassifiedMapUpload => {
  let fullJson: UploadedMapFile | null = null
  const optionalFiles: ClassifiedMapUpload['optionalFiles'] = []

  for (const file of files) {
    const lowered = file.filename.toLowerCase()
    if (lowered.endsWith('.json') && !lowered.endsWith('.geojson')) {
      if (!fullJson || lowered.includes('full')) {
        fullJson = file
      }
      continue
    }

    const kind = getFeatureTypeFromKind(lowered)
    if (kind) {
      optionalFiles.push({ ...file, kind })
    }
  }

  if (!fullJson) {
    throw new Error('Full JSON export is required')
  }

  return {
    fullJson,
    optionalFiles,
  }
}

const convexHull = (points: Array<[number, number]>) => {
  const sorted = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]))
  if (sorted.length < 3) return sorted

  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

  const lower: Array<[number, number]> = []
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) {
      lower.pop()
    }
    lower.push(point)
  }

  const upper: Array<[number, number]> = []
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) {
      upper.pop()
    }
    upper.push(point)
  }

  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

const extractVectorExtent = (pack: Record<string, unknown>) => {
  let maxX = 1000
  let maxY = 1000

  const probe = (x: number, y: number) => {
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  for (const cell of getArray<AzgaarEntity>(pack.cells)) {
    const point = getArray<number>(cell.p)
    if (point.length >= 2) probe(point[0]!, point[1]!)
  }

  for (const burg of getArray<AzgaarEntity>(pack.burgs)) {
    const x = getNumber(burg.x)
    const y = getNumber(burg.y)
    if (x !== null && y !== null) probe(x, y)
  }

  for (const marker of getArray<AzgaarEntity>(pack.markers)) {
    const x = getNumber(marker.x)
    const y = getNumber(marker.y)
    if (x !== null && y !== null) probe(x, y)
  }

  for (const route of getArray<AzgaarEntity>(pack.routes)) {
    const points = getArray<Array<number>>(route.points)
    for (const point of points) {
      if (point.length >= 2) probe(point[0]!, point[1]!)
    }
  }

  return { maxX, maxY }
}

export const parseAzgaarFullJson = (payload: Buffer): ParsedAzgaarMap => {
  const json = JSON.parse(payload.toString('utf8')) as Record<string, unknown>
  const pack = isObject(json.pack) ? json.pack : {}
  const notesById = new Map(
    getArray<AzgaarEntity>(json.notes).map((entry) => [getString(entry.id), entry])
  )
  const sourceFingerprint = createHash('sha256').update(payload).digest('hex')
  const { maxX, maxY } = extractVectorExtent(pack)
  const info = isObject(json.info) ? json.info : {}
  const mapCoordinates = isObject(json.mapCoordinates) ? json.mapCoordinates : null

  const infoWidth = getNumber(info.width)
  const infoHeight = getNumber(info.height)
  const projectionWidth = (infoWidth !== null && infoWidth > 0) ? infoWidth : maxX
  const projectionHeight = (infoHeight !== null && infoHeight > 0) ? infoHeight : maxY
  const lonW = mapCoordinates ? getNumber(mapCoordinates.lonW) : null
  const lonE = mapCoordinates ? getNumber(mapCoordinates.lonE) : null
  const latN = mapCoordinates ? getNumber(mapCoordinates.latN) : null
  const latS = mapCoordinates ? getNumber(mapCoordinates.latS) : null
  const lonT =
    mapCoordinates
      ? (getNumber(mapCoordinates.lonT) ?? ((lonW !== null && lonE !== null) ? lonE - lonW : null))
      : null
  const latT =
    mapCoordinates
      ? (getNumber(mapCoordinates.latT) ?? ((latN !== null && latS !== null) ? latN - latS : null))
      : null
  const hasMappedProjection =
    lonW !== null &&
    latN !== null &&
    lonT !== null &&
    latT !== null &&
    projectionWidth > 0 &&
    projectionHeight > 0

  const toLngLat = (x: number, y: number): [number, number] => {
    if (hasMappedProjection) {
      return [
        round(lonW! + (x / projectionWidth) * lonT!),
        round(latN! - (y / projectionHeight) * latT!),
      ]
    }
    return [
      round((x / maxX) * 360 - 180),
      round(85 - (y / maxY) * 170),
    ]
  }

  const vertices = getArray<AzgaarEntity>(pack.vertices)
  const cells = getArray<AzgaarEntity>(pack.cells)
  const cellCentroids = new Map<number, [number, number]>()
  const cellsByState = new Map<number, Array<[number, number]>>()
  const cellsByProvince = new Map<number, Array<[number, number]>>()

  for (const cell of cells) {
    const cellId = getNumber(cell.i)
    const point = getArray<number>(cell.p)
    if (cellId === null || point.length < 2) continue
    const coordinates = toLngLat(point[0]!, point[1]!)
    cellCentroids.set(cellId, coordinates)

    const stateId = getNumber(cell.state)
    if (stateId !== null) {
      const bucket = cellsByState.get(stateId) || []
      bucket.push(coordinates)
      cellsByState.set(stateId, bucket)
    }

    const provinceId = getNumber(cell.province)
    if (provinceId !== null) {
      const bucket = cellsByProvince.get(provinceId) || []
      bucket.push(coordinates)
      cellsByProvince.set(provinceId, bucket)
    }
  }

  const boundsState = {
    minLng: Infinity,
    minLat: Infinity,
    maxLng: -Infinity,
    maxLat: -Infinity,
  }
  const trackBounds = (coords: [number, number]) => {
    if (coords[0] < boundsState.minLng) boundsState.minLng = coords[0]
    if (coords[0] > boundsState.maxLng) boundsState.maxLng = coords[0]
    if (coords[1] < boundsState.minLat) boundsState.minLat = coords[1]
    if (coords[1] > boundsState.maxLat) boundsState.maxLat = coords[1]
  }

  const features: ParsedMapFeature[] = []
  const pushFeature = (feature: ParsedMapFeature) => {
    feature.name = stripLoneSurrogates(feature.name)
    feature.displayName = stripLoneSurrogates(feature.displayName)
    feature.normalizedName = stripLoneSurrogates(feature.normalizedName)
    feature.description = feature.description
      ? stripLoneSurrogates(feature.description)
      : undefined
    feature.sourceRef = stripLoneSurrogates(feature.sourceRef)
    feature.geometryType = stripLoneSurrogates(feature.geometryType)
    feature.geometryJson = sanitizeJsonValue(feature.geometryJson)
    feature.propertiesJson = feature.propertiesJson
      ? sanitizeJsonValue(feature.propertiesJson)
      : undefined

    const geometry = feature.geometryJson as Record<string, unknown>
    const geometryCoordinates = geometry.coordinates
    if (Array.isArray(geometryCoordinates)) {
      const visit = (node: unknown): void => {
        if (Array.isArray(node) && node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
          trackBounds([node[0], node[1]])
          return
        }
        if (Array.isArray(node)) {
          for (const entry of node) visit(entry)
        }
      }
      visit(geometryCoordinates)
    }
    features.push(feature)
  }

  for (const state of getArray<AzgaarEntity>(pack.states)) {
    const id = getNumber(state.i)
    if (id === null || id <= 0) continue
    const points = cellsByState.get(id) || []
    if (!points.length) continue
    const hull = convexHull(points)
    const polygon = hull.length >= 3 ? [hull.concat([hull[0]!])] : [[points[0]!, points[0]!, points[0]!, points[0]!]]
    const name = getString(state.name) || `State ${id}`
    pushFeature({
      externalId: String(id),
      featureType: 'state',
      name,
      displayName: name,
      normalizedName: normalizeMapName(name),
      description: getString(state.fullName) || undefined,
      geometryType: 'Polygon',
      geometryJson: {
        type: 'Polygon',
        coordinates: polygon,
      },
      propertiesJson: {
        form: state.form,
        formName: state.formName,
        fullName: state.fullName,
      },
      sourceRef: `pack.states[${id}]`,
      removed: Boolean(state.removed),
    })
  }

  for (const province of getArray<AzgaarEntity>(pack.provinces)) {
    const id = getNumber(province.i)
    if (id === null) continue
    const points = cellsByProvince.get(id) || []
    if (!points.length) continue
    const hull = convexHull(points)
    const polygon = hull.length >= 3 ? [hull.concat([hull[0]!])] : [[points[0]!, points[0]!, points[0]!, points[0]!]]
    const name = getString(province.name) || `Province ${id}`
    pushFeature({
      externalId: String(id),
      featureType: 'province',
      name,
      displayName: name,
      normalizedName: normalizeMapName(name),
      description: getString(province.fullName) || undefined,
      geometryType: 'Polygon',
      geometryJson: {
        type: 'Polygon',
        coordinates: polygon,
      },
      propertiesJson: {
        state: province.state,
      },
      sourceRef: `pack.provinces[${id}]`,
      removed: Boolean(province.removed),
    })
  }

  for (const burg of getArray<AzgaarEntity>(pack.burgs)) {
    const id = getNumber(burg.i)
    const x = getNumber(burg.x)
    const y = getNumber(burg.y)
    if (id === null || x === null || y === null) continue
    const name = getString(burg.name) || `Burg ${id}`
    pushFeature({
      externalId: String(id),
      featureType: 'burg',
      name,
      displayName: name,
      normalizedName: normalizeMapName(name),
      description: `Settlement in state ${getNumber(burg.state) ?? 0}`,
      geometryType: 'Point',
      geometryJson: {
        type: 'Point',
        coordinates: toLngLat(x, y),
      },
      propertiesJson: {
        state: burg.state,
        culture: burg.culture,
        population: burg.population,
        type: burg.type,
        capital: burg.capital,
      },
      sourceRef: `pack.burgs[${id}]`,
      removed: Boolean(burg.removed),
    })
  }

  for (const marker of getArray<AzgaarEntity>(pack.markers)) {
    const id = getNumber(marker.i)
    const x = getNumber(marker.x)
    const y = getNumber(marker.y)
    if (id === null || x === null || y === null) continue
    const note = notesById.get(`marker${id}`)
    const noteName = getString(note?.name)
    const legend = getString(note?.legend)
    const markerType = getString(marker.type) || 'marker'
    const name = noteName || `${markerType} ${id}`
    pushFeature({
      externalId: String(id),
      featureType: 'marker',
      name,
      displayName: name,
      normalizedName: normalizeMapName(name),
      description: legend || `Marker type: ${markerType}`,
      geometryType: 'Point',
      geometryJson: {
        type: 'Point',
        coordinates: toLngLat(x, y),
      },
      propertiesJson: {
        icon: marker.icon,
        type: marker.type,
        noteId: `marker${id}`,
      },
      sourceRef: `pack.markers[${id}]`,
      removed: Boolean(marker.removed),
    })
  }

  for (const river of getArray<AzgaarEntity>(pack.rivers)) {
    const id = getNumber(river.i)
    if (id === null) continue
    const line = getArray<number>(river.cells)
      .map((cellId) => cellCentroids.get(cellId))
      .filter((value): value is [number, number] => Boolean(value))
    if (line.length < 2) continue
    const name = getString(river.name) || `River ${id}`
    pushFeature({
      externalId: String(id),
      featureType: 'river',
      name,
      displayName: name,
      normalizedName: normalizeMapName(name),
      description: `${getString(river.type) || 'River'} (${round(Number(river.length) || 0)} units)`,
      geometryType: 'LineString',
      geometryJson: {
        type: 'LineString',
        coordinates: line,
      },
      propertiesJson: {
        source: river.source,
        mouth: river.mouth,
        length: river.length,
        type: river.type,
      },
      sourceRef: `pack.rivers[${id}]`,
      removed: Boolean(river.removed),
    })
  }

  for (const route of getArray<AzgaarEntity>(pack.routes)) {
    const id = getNumber(route.i)
    if (id === null) continue
    const line = getArray<Array<number>>(route.points)
      .filter((point) => point.length >= 2)
      .map((point) => toLngLat(point[0]!, point[1]!))
    if (line.length < 2) continue
    const name = `Route ${id}`
    pushFeature({
      externalId: String(id),
      featureType: 'route',
      name,
      displayName: name,
      normalizedName: normalizeMapName(name),
      description: `Route group: ${getString(route.group) || 'unknown'}`,
      geometryType: 'LineString',
      geometryJson: {
        type: 'LineString',
        coordinates: line,
      },
      propertiesJson: {
        group: route.group,
        feature: route.feature,
      },
      sourceRef: `pack.routes[${id}]`,
      removed: Boolean(route.removed),
    })
  }

  for (const cell of cells) {
    const id = getNumber(cell.i)
    if (id === null) continue
    const vertexIds = getArray<number>(cell.v)
    const ring: Array<[number, number]> = []
    for (const vertexId of vertexIds) {
      const vertex = vertices[vertexId]
      if (!isObject(vertex)) continue
      const point = getArray<number>(vertex.p)
      if (point.length < 2) continue
      ring.push(toLngLat(point[0]!, point[1]!))
    }
    if (ring.length < 3) continue
    ring.push(ring[0]!)
    const name = `Cell ${id}`
    pushFeature({
      externalId: String(id),
      featureType: 'cell',
      name,
      displayName: name,
      normalizedName: normalizeMapName(name),
      description: `Terrain cell (state ${getNumber(cell.state) ?? 0})`,
      geometryType: 'Polygon',
      geometryJson: {
        type: 'Polygon',
        coordinates: [ring],
      },
      propertiesJson: {
        state: cell.state,
        province: cell.province,
        biome: cell.biome,
        burg: cell.burg,
        river: cell.r,
      },
      sourceRef: `pack.cells[${id}]`,
      removed: Boolean(cell.removed),
    })
  }

  const bounds: [[number, number], [number, number]] =
    Number.isFinite(boundsState.minLng) && Number.isFinite(boundsState.minLat)
      ? [
          [boundsState.minLng, boundsState.minLat],
          [boundsState.maxLng, boundsState.maxLat],
        ]
      : [[-180, -85], [180, 85]]

  return {
    features,
    sourceFingerprint,
    bounds,
    mapName: getString(json.info && isObject(json.info) ? json.info.mapName : undefined) || getString(json.settings && isObject(json.settings) ? json.settings.name : undefined),
    metadata: {
      mapCoordinates: json.mapCoordinates,
      sourceSize: payload.byteLength,
      slug: slugify(getString(json.info && isObject(json.info) ? json.info.mapName : undefined) || 'imported-map'),
    },
  }
}

export const buildFeatureDiff = (
  existing: Array<{ featureType: string; externalId: string; name: string; displayName: string; removed: boolean; geometryType: string }>,
  incoming: ParsedMapFeature[]
) => {
  const toKey = (featureType: string, externalId: string) =>
    `${featureType.trim().toUpperCase()}:${externalId}`
  const incomingByKey = new Map(
    incoming.map((entry) => [toKey(entry.featureType, entry.externalId), entry])
  )
  const existingByKey = new Map(existing.map((entry) => [toKey(entry.featureType, entry.externalId), entry]))

  let added = 0
  let removed = 0
  let changed = 0

  for (const [key, entry] of incomingByKey) {
    const current = existingByKey.get(key)
    if (!current) {
      added += 1
      continue
    }
    if (
      current.displayName !== entry.displayName ||
      current.name !== entry.name ||
      current.removed !== entry.removed ||
      current.geometryType !== entry.geometryType
    ) {
      changed += 1
    }
  }

  for (const key of existingByKey.keys()) {
    if (!incomingByKey.has(key)) removed += 1
  }

  return { added, removed, changed }
}
