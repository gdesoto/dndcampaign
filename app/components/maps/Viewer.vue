<script setup lang="ts">
import type { CampaignMapViewerDto, MapFeatureType } from '#shared/types/api/map'

const props = defineProps<{
  viewer: CampaignMapViewerDto | null
  svgBackgroundUrl?: string
  activeLayers: MapFeatureType[]
  selectedFeatureIds: string[]
}>()

const emit = defineEmits<{
  'update:selectedFeatureIds': [value: string[]]
  featureHover: [value: { id: string; name: string; type: string } | null]
}>()

const containerRef = ref<HTMLElement | null>(null)
const isReady = ref(false)
const mapError = ref('')

type MapLike = {
  remove: () => void
  addControl: (...args: any[]) => void
  addSource: (...args: any[]) => void
  addLayer: (...args: any[]) => void
  getLayer: (id: string) => unknown
  getSource: (id: string) => { setData: (data: unknown) => void } | undefined
  setLayoutProperty: (id: string, name: string, value: unknown) => void
  on: (event: string, callback: (...args: any[]) => void) => void
  queryRenderedFeatures: (point: unknown, options?: unknown) => Array<{ properties?: Record<string, unknown> }>
  fitBounds: (...args: any[]) => void
  project: (lngLat: [number, number]) => { x: number; y: number }
  getContainer: () => HTMLElement
  getZoom: () => number
  setZoom: (value: number) => void
  setMinZoom: (value: number) => void
  setMaxBounds: (value: [[number, number], [number, number]] | null) => void
  getCanvas: () => HTMLCanvasElement
}

const mapRef = shallowRef<MapLike | null>(null)
const hoverState = ref<{ x: number; y: number; name: string; type: string } | null>(null)

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to decode map background image'))
    image.src = src
  })

const buildRasterBackgroundDataUrl = async (sourceUrl: string) => {
  const response = await fetch(sourceUrl, { credentials: 'include' })
  if (!response.ok) {
    throw new Error(`Unable to fetch SVG background (${response.status})`)
  }
  const blob = await response.blob()
  const contentType = response.headers.get('content-type') || blob.type || ''

  if (!contentType.includes('svg')) {
    throw new Error(`Unexpected background content type: ${contentType || 'unknown'}`)
  }

  const svgBlobUrl = URL.createObjectURL(blob)
  try {
    const image = await loadImage(svgBlobUrl)
    const width = Math.max(Math.round(image.naturalWidth || image.width || 1920), 1)
    const height = Math.max(Math.round(image.naturalHeight || image.height || 1080), 1)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Unable to initialize background raster canvas')
    }
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(svgBlobUrl)
  }
}

const allFeatures = computed(() => props.viewer?.features || [])

const sourceCollection = computed(() => ({
  type: 'FeatureCollection',
  features: allFeatures.value.map((feature) => ({
    ...feature,
    id: feature.id,
  })),
}))

const selectedCollection = computed(() => ({
  type: 'FeatureCollection',
  features: sourceCollection.value.features.filter((feature) =>
    props.selectedFeatureIds.includes(String(feature.id))
  ),
}))

const mapDisplayBounds = computed(() => {
  const coords = props.viewer?.map.mapCoordinates
  if (coords) {
    return [
      [coords.lonW, coords.latS],
      [coords.lonE, coords.latN],
    ] as [[number, number], [number, number]]
  }
  return props.viewer?.map.bounds || null
})

const fitBoundsCoverAndLock = (map: MapLike, bounds: [[number, number], [number, number]]) => {
  map.fitBounds(bounds, { padding: 0, duration: 0 })

  const [[minLng, minLat], [maxLng, maxLat]] = bounds
  const bottomLeft = map.project([minLng, minLat])
  const topRight = map.project([maxLng, maxLat])
  const spanX = Math.max(Math.abs(topRight.x - bottomLeft.x), 1)
  const spanY = Math.max(Math.abs(topRight.y - bottomLeft.y), 1)
  const container = map.getContainer()
  const scaleX = container.clientWidth / spanX
  const scaleY = container.clientHeight / spanY
  const coverScale = Math.max(scaleX, scaleY)

  if (coverScale > 1.0001) {
    map.setZoom(map.getZoom() + Math.log2(coverScale))
  }

  map.setMinZoom(Math.max(0, map.getZoom()))
}

const svgImageCoordinates = computed(() => {
  const coords = props.viewer?.map.mapCoordinates
  if (!props.svgBackgroundUrl) return null
  if (!coords) {
    const bounds = props.viewer?.map.bounds
    if (!bounds) return null
    const [[minLng, minLat], [maxLng, maxLat]] = bounds
    return [
      [minLng, maxLat],
      [maxLng, maxLat],
      [maxLng, minLat],
      [minLng, minLat],
    ] as [[number, number], [number, number], [number, number], [number, number]]
  }
  return [
    [coords.lonW, coords.latN],
    [coords.lonE, coords.latN],
    [coords.lonE, coords.latS],
    [coords.lonW, coords.latS],
  ] as [[number, number], [number, number], [number, number], [number, number]]
})

const layerIdsByType: Record<MapFeatureType, string[]> = {
  state: ['map-state-fill', 'map-state-line'],
  province: ['map-province-fill', 'map-province-line'],
  burg: ['map-burg-point'],
  marker: ['map-marker-point'],
  river: ['map-river-line'],
  route: ['map-route-line'],
  cell: ['map-cell-fill', 'map-cell-line'],
}

const interactiveLayerIds = Object.values(layerIdsByType).flat()

const updateLayerVisibility = () => {
  const map = mapRef.value
  if (!map) return
  for (const [type, ids] of Object.entries(layerIdsByType) as Array<[MapFeatureType, string[]]>) {
    const visible = props.activeLayers.includes(type)
    for (const layerId of ids) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
      }
    }
  }
}

const updateSource = () => {
  const map = mapRef.value
  if (!map) return
  const source = map.getSource('campaign-map-features')
  if (source) {
    source.setData(sourceCollection.value)
  }
}

const updateSelectedSource = () => {
  const map = mapRef.value
  if (!map) return
  const source = map.getSource('campaign-map-selected')
  if (source) {
    source.setData(selectedCollection.value)
  }
}

onMounted(async () => {
  if (!containerRef.value) return
  try {
    const maplibregl = await import('maplibre-gl')
    const map = new maplibregl.Map({
      container: containerRef.value,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#f2e7ca' },
          },
        ],
      },
      center: [0, 0],
      zoom: 2,
      attributionControl: false,
    }) as unknown as MapLike

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', async () => {
      if (props.svgBackgroundUrl && svgImageCoordinates.value) {
        let backgroundUrl = props.svgBackgroundUrl
        try {
          backgroundUrl = await buildRasterBackgroundDataUrl(props.svgBackgroundUrl)
        } catch (error) {
          console.warn('Skipping SVG background layer:', error)
          backgroundUrl = ''
        }
        if (backgroundUrl) {
          map.addSource('campaign-map-svg', {
            type: 'image',
            url: backgroundUrl,
            coordinates: svgImageCoordinates.value,
          })
          map.addLayer({
            id: 'map-svg-background',
            type: 'raster',
            source: 'campaign-map-svg',
            paint: {
              'raster-opacity': 0.95,
              'raster-fade-duration': 0,
            },
          })
        }
      }

      map.addSource('campaign-map-features', {
        type: 'geojson',
        data: sourceCollection.value,
      })
      map.addSource('campaign-map-selected', {
        type: 'geojson',
        data: selectedCollection.value,
      })

      map.addLayer({
        id: 'map-cell-fill',
        type: 'fill',
        source: 'campaign-map-features',
        filter: ['==', ['get', 'featureType'], 'cell'],
        paint: { 'fill-color': '#d7c39a', 'fill-opacity': 0.18 },
      })
      map.addLayer({
        id: 'map-cell-line',
        type: 'line',
        source: 'campaign-map-features',
        filter: ['==', ['get', 'featureType'], 'cell'],
        paint: { 'line-color': '#9f7f4b', 'line-width': 0.4, 'line-opacity': 0.2 },
      })
      map.addLayer({
        id: 'map-state-fill',
        type: 'fill',
        source: 'campaign-map-features',
        filter: ['==', ['get', 'featureType'], 'state'],
        paint: { 'fill-color': '#4a6752', 'fill-opacity': 0.18 },
      })
      map.addLayer({
        id: 'map-state-line',
        type: 'line',
        source: 'campaign-map-features',
        filter: ['==', ['get', 'featureType'], 'state'],
        paint: { 'line-color': '#1f3b2d', 'line-width': 1.8 },
      })
      map.addLayer({
        id: 'map-province-fill',
        type: 'fill',
        source: 'campaign-map-features',
        filter: ['==', ['get', 'featureType'], 'province'],
        paint: { 'fill-color': '#7a9b83', 'fill-opacity': 0.16 },
      })
      map.addLayer({
        id: 'map-province-line',
        type: 'line',
        source: 'campaign-map-features',
        filter: ['==', ['get', 'featureType'], 'province'],
        paint: { 'line-color': '#3f5c49', 'line-width': 1.1, 'line-dasharray': [2, 1] },
      })
      map.addLayer({
        id: 'map-river-line',
        type: 'line',
        source: 'campaign-map-features',
        filter: ['==', ['get', 'featureType'], 'river'],
        paint: { 'line-color': '#2a74a0', 'line-width': 1.8 },
      })
      map.addLayer({
        id: 'map-route-line',
        type: 'line',
        source: 'campaign-map-features',
        filter: ['==', ['get', 'featureType'], 'route'],
        paint: { 'line-color': '#6b4e30', 'line-width': 1.4, 'line-dasharray': [1, 1] },
      })
      map.addLayer({
        id: 'map-burg-point',
        type: 'circle',
        source: 'campaign-map-features',
        filter: ['==', ['get', 'featureType'], 'burg'],
        paint: {
          'circle-radius': 4.5,
          'circle-color': '#f3a14b',
          'circle-stroke-color': '#2c231c',
          'circle-stroke-width': 1,
        },
      })
      map.addLayer({
        id: 'map-marker-point',
        type: 'circle',
        source: 'campaign-map-features',
        filter: ['==', ['get', 'featureType'], 'marker'],
        paint: {
          'circle-radius': 4.8,
          'circle-color': '#b63b2f',
          'circle-stroke-color': '#fff4e0',
          'circle-stroke-width': 1.1,
        },
      })

      map.addLayer({
        id: 'map-selected-fill',
        type: 'fill',
        source: 'campaign-map-selected',
        paint: { 'fill-color': '#e8862d', 'fill-opacity': 0.26 },
      })
      map.addLayer({
        id: 'map-selected-line',
        type: 'line',
        source: 'campaign-map-selected',
        paint: { 'line-color': '#c86b1f', 'line-width': 2.2 },
      })
      map.addLayer({
        id: 'map-selected-point',
        type: 'circle',
        source: 'campaign-map-selected',
        paint: {
          'circle-radius': 7,
          'circle-color': '#e8862d',
          'circle-stroke-color': '#fff8eb',
          'circle-stroke-width': 1.5,
        },
      })

      map.on('mousemove', (event: { point: unknown; originalEvent: MouseEvent }) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: interactiveLayerIds,
        })
        if (!features.length) {
          hoverState.value = null
          emit('featureHover', null)
          map.getCanvas().style.cursor = ''
          return
        }

        map.getCanvas().style.cursor = 'pointer'
        const current = features.find((feature) => feature.properties?.featureType !== 'state') || features[0]!
        const properties = current.properties || {}
        hoverState.value = {
          x: event.originalEvent.clientX,
          y: event.originalEvent.clientY,
          name: String(properties.displayName || 'Unknown'),
          type: String(properties.featureType || 'feature'),
        }
        emit('featureHover', {
          id: String(properties.mapFeatureId || ''),
          name: String(properties.displayName || ''),
          type: String(properties.featureType || ''),
        })
      })

      map.on('mouseleave', () => {
        hoverState.value = null
        map.getCanvas().style.cursor = ''
        emit('featureHover', null)
      })

      map.on('click', (event: { point: unknown }) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: interactiveLayerIds,
        })
        if (!features.length) return
        const target = features.find((feature) => feature.properties?.featureType !== 'state') || features[0]!
        const properties = target.properties || {}
        const featureId = String(properties.mapFeatureId || '')
        if (!featureId) return
        const next = props.selectedFeatureIds.includes(featureId)
          ? props.selectedFeatureIds.filter((entry) => entry !== featureId)
          : [...props.selectedFeatureIds, featureId]
        emit('update:selectedFeatureIds', next)
      })

      const bounds = mapDisplayBounds.value
      if (bounds) {
        map.setMaxBounds(bounds)
        fitBoundsCoverAndLock(map, bounds)
      }
      updateLayerVisibility()
      updateSelectedSource()
      isReady.value = true
    })

    mapRef.value = map
  } catch (error) {
    mapError.value = (error as Error).message || 'Unable to initialize map viewer.'
  }
})

watch(
  () => props.activeLayers,
  () => updateLayerVisibility(),
  { deep: true }
)

watch(sourceCollection, () => {
  updateSource()
})

watch(
  () => props.selectedFeatureIds,
  () => updateSelectedSource(),
  { deep: true }
)

watch(
  mapDisplayBounds,
  (value) => {
    if (!value || !mapRef.value) return
    mapRef.value.setMaxBounds(value)
    fitBoundsCoverAndLock(mapRef.value, value)
  },
  { deep: true }
)

onBeforeUnmount(() => {
  mapRef.value?.remove()
  mapRef.value = null
})
</script>

<template>
  <div class="relative">
    <div
      ref="containerRef"
      class="h-[520px] w-full overflow-hidden rounded-lg border border-[var(--theme-panel-border)] bg-[var(--theme-panel-bg)]"
    />
    <div
      v-if="hoverState"
      class="pointer-events-none fixed z-30 rounded-md border border-[var(--theme-panel-border)] bg-[var(--theme-card-bg)] px-3 py-2 text-xs shadow-xl"
      :style="{ left: `${hoverState.x + 14}px`, top: `${hoverState.y + 14}px` }"
    >
      <p class="font-semibold text-default">{{ hoverState.name }}</p>
      <p class="uppercase tracking-[0.2em] text-dimmed">{{ hoverState.type }}</p>
    </div>
    <div
      v-if="!isReady && !mapError"
      class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted"
    >
      Loading map viewer...
    </div>
    <div v-if="mapError" class="absolute inset-0 flex items-center justify-center p-4 text-sm text-error">
      {{ mapError }}
    </div>
  </div>
</template>
