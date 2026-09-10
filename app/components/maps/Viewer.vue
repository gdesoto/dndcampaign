<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Map as MapLibreMap, GeoJSONSource, ImageSource, ExpressionSpecification, PointLike } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { loadSvgBackground } from './svg-background'
import type { CampaignMapViewerDto, MapFeatureType } from '#shared/types/api/map'

const props = defineProps<{
  viewer: CampaignMapViewerDto | null
  svgBackgroundUrl?: string
  activeLayers: MapFeatureType[]
  selectedFeatureIds: string[]
  glossaryPointsOnly?: boolean
}>()

const emit = defineEmits<{
  'update:selectedFeatureIds': [value: string[]]
  featureHover: [value: { id: string; name: string; type: string } | null]
}>()

const containerRef = ref<HTMLElement | null>(null)
const isReady = ref(false)
const mapError = ref('')
let disposed = false
let background: Awaited<ReturnType<typeof loadSvgBackground>> | null = null
let backgroundRequest = 0
let backgroundAbort: AbortController | null = null
let backgroundScale = 0
const mapRef = shallowRef<MapLibreMap | null>(null)
const hoverState = ref<{ x: number; y: number; name: string; type: string } | null>(null)

const allFeatures = computed(() => props.viewer?.features || [])

const sourceCollection = computed<FeatureCollection>(() => ({
  type: 'FeatureCollection',
  // The API supplies GeoJSON produced by the Azgaar importer.
  features: allFeatures.value as FeatureCollection['features'],
}))

const selectionFilter = computed<ExpressionSpecification>(() => [
  'in', ['get', 'mapFeatureId'], ['literal', props.selectedFeatureIds],
])
const selectedLayerIds = ['map-selected-fill', 'map-selected-line', 'map-selected-point']

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

const fitMapBounds = () => {
  const map = mapRef.value
  if (!map) return
  const bounds = mapDisplayBounds.value
  // Native constraints cover the viewport and stay correct after container resizes.
  map.setMaxBounds(bounds)
  if (bounds) map.fitBounds(bounds, { padding: 0, duration: 0 })
}

const svgImageCoordinates = computed(() => {
  if (!mapDisplayBounds.value) return null
  const [[west, south], [east, north]] = mapDisplayBounds.value
  return [[west, north], [east, north], [east, south], [west, south]] as
    [[number, number], [number, number], [number, number], [number, number]]
})

const updateBackgroundScale = () => {
  const map = mapRef.value
  const source = map?.getSource<ImageSource>('campaign-map-svg')
  if (!map || !source || !background) return
  const zoom = map.getZoom()
  const scale = zoom >= 7 ? 4 : zoom >= 5 ? 3 : zoom >= 3 ? 2 : 1
  if (scale === backgroundScale) return
  source.updateImage({ image: background.rasterize(scale) })
  backgroundScale = scale
}

const updateBackground = async () => {
  const map = mapRef.value
  if (!map || !isReady.value) return
  const request = ++backgroundRequest
  backgroundAbort?.abort()
  backgroundAbort = new AbortController()
  background = null
  backgroundScale = 0
  const source = map.getSource<ImageSource>('campaign-map-svg')
  if (!source) return
  map.setLayoutProperty('map-svg-background', 'visibility', 'none')
  if (!props.svgBackgroundUrl || !svgImageCoordinates.value) return
  source.setCoordinates(svgImageCoordinates.value)
  try {
    const loaded = await loadSvgBackground(props.svgBackgroundUrl, backgroundAbort.signal)
    if (disposed || request !== backgroundRequest) return
    background = loaded
    updateBackgroundScale()
    map.setLayoutProperty('map-svg-background', 'visibility', 'visible')
  } catch (error) {
    if (!disposed && request === backgroundRequest && !backgroundAbort.signal.aborted) {
      console.warn('Skipping SVG background layer:', error)
    }
  }
}

const layerIdsByType: Record<MapFeatureType, string[]> = {
  state: ['map-state-fill', 'map-state-line'],
  province: ['map-province-fill', 'map-province-line'],
  burg: ['map-burg-capital', 'map-burg-major', 'map-burg-minor'],
  marker: ['map-marker-point'],
  river: ['map-river-line'],
  route: ['map-route-line'],
  cell: ['map-cell-fill', 'map-cell-line'],
}

const interactiveLayerIds = Object.values(layerIdsByType).flat()

const toNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const burgPopulationThresholds = computed(() => {
  const burgs = allFeatures.value
    .filter((feature) => feature.properties.featureType === 'burg')
    .map((feature) => toNumber(feature.properties.population, 0))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)

  if (!burgs.length) {
    return {
      major: 10,
    }
  }

  const q90 = burgs[Math.floor((burgs.length - 1) * 0.9)] || 0
  return {
    major: Math.max(3, Number(q90.toFixed(2))),
  }
})

const baseGlossaryFilter = (featureType: MapFeatureType): ExpressionSpecification =>
  props.glossaryPointsOnly
    ? [
        'all',
        ['==', ['get', 'featureType'], featureType],
        ['==', ['get', 'glossaryLinkedOrMatched'], true],
      ]
    : ['==', ['get', 'featureType'], featureType]

const burgFilter = (bucket: 'capital' | 'major' | 'minor'): ExpressionSpecification => {
  const withGlossary = baseGlossaryFilter('burg')
  if (bucket === 'capital') {
    return ['all', withGlossary, ['==', ['to-boolean', ['coalesce', ['get', 'capital'], false]], true]]
  }
  if (bucket === 'major') {
    return [
      'all',
      withGlossary,
      ['==', ['to-boolean', ['coalesce', ['get', 'capital'], false]], false],
      ['>=', ['to-number', ['coalesce', ['get', 'population'], 0]], burgPopulationThresholds.value.major],
    ]
  }
  return [
    'all',
    withGlossary,
    ['==', ['to-boolean', ['coalesce', ['get', 'capital'], false]], false],
    ['<', ['to-number', ['coalesce', ['get', 'population'], 0]], burgPopulationThresholds.value.major],
  ]
}

const updateGlossaryFilters = () => {
  const map = mapRef.value
  if (!map) return
  for (const type of ['state', 'burg', 'marker'] as const) {
    for (const id of layerIdsByType[type]) {
      if (!map.getLayer(id)) continue
      const filter = type === 'burg'
        ? burgFilter(id === 'map-burg-capital' ? 'capital' : id === 'map-burg-major' ? 'major' : 'minor')
        : baseGlossaryFilter(type)
      map.setFilter(id, filter)
    }
  }
}

const updateLayerVisibility = () => {
  const map = mapRef.value
  if (!map) return
  for (const [type, ids] of Object.entries(layerIdsByType) as Array<[MapFeatureType, string[]]>) {
    const glossaryOnly = props.glossaryPointsOnly
    const isGlossaryToggleType = type === 'state' || type === 'burg' || type === 'marker'
    const visible = props.activeLayers.includes(type) && (!glossaryOnly || isGlossaryToggleType)
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
  const source = map.getSource<GeoJSONSource>('campaign-map-features')
  if (source) {
    source.setData(sourceCollection.value)
  }
}

const updateSelection = () => {
  const map = mapRef.value
  if (!map) return
  for (const id of selectedLayerIds) {
    if (map.getLayer(id)) map.setFilter(id, selectionFilter.value)
  }
}

const featureAt = (map: MapLibreMap, point: PointLike) => {
  const features = map.queryRenderedFeatures(point, { layers: interactiveLayerIds })
  return features.find(feature => feature.properties.featureType !== 'state') || features[0]
}

const clearHover = () => {
  hoverState.value = null
  if (mapRef.value) mapRef.value.getCanvas().style.cursor = ''
  emit('featureHover', null)
}

onMounted(async () => {
  if (!containerRef.value) return
  try {
    const [maplibregl, { default: workerUrl }] = await Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
    ])
    if (disposed || !containerRef.value) return
    maplibregl.setWorkerUrl(workerUrl)
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
    })
    mapRef.value = map

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      if (disposed) return
      map.addSource('campaign-map-svg', {
        type: 'image',
        coordinates: svgImageCoordinates.value || [[-180, 85], [180, 85], [180, -85], [-180, -85]],
      })
      map.addLayer({
        id: 'map-svg-background',
        type: 'raster',
        source: 'campaign-map-svg',
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 0.95, 'raster-fade-duration': 0 },
      })

      map.addSource('campaign-map-features', {
        type: 'geojson',
        data: sourceCollection.value,
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
        filter: baseGlossaryFilter('state'),
        paint: { 'fill-color': '#4a6752', 'fill-opacity': 0.18 },
      })
      map.addLayer({
        id: 'map-state-line',
        type: 'line',
        source: 'campaign-map-features',
        filter: baseGlossaryFilter('state'),
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
        id: 'map-burg-capital',
        type: 'circle',
        source: 'campaign-map-features',
        filter: burgFilter('capital'),
        paint: {
          'circle-radius': 5.3,
          'circle-color': '#ffd400',
          'circle-stroke-color': '#2f241a',
          'circle-stroke-width': 1.2,
        },
      })
      map.addLayer({
        id: 'map-burg-major',
        type: 'circle',
        source: 'campaign-map-features',
        minzoom: 7,
        filter: burgFilter('major'),
        paint: {
          'circle-radius': 4.7,
          'circle-color': '#f3a14b',
          'circle-stroke-color': '#2c231c',
          'circle-stroke-width': 1,
        },
      })
      map.addLayer({
        id: 'map-burg-minor',
        type: 'circle',
        source: 'campaign-map-features',
        minzoom: 9,
        filter: burgFilter('minor'),
        paint: {
          'circle-radius': 3.8,
          'circle-color': '#e58f3a',
          'circle-stroke-color': '#2c231c',
          'circle-stroke-width': 0.9,
        },
      })
      map.addLayer({
        id: 'map-marker-point',
        type: 'circle',
        source: 'campaign-map-features',
        filter: baseGlossaryFilter('marker'),
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
        source: 'campaign-map-features',
        filter: selectionFilter.value,
        paint: { 'fill-color': '#e8862d', 'fill-opacity': 0.26 },
      })
      map.addLayer({
        id: 'map-selected-line',
        type: 'line',
        source: 'campaign-map-features',
        filter: selectionFilter.value,
        paint: { 'line-color': '#c86b1f', 'line-width': 2.2 },
      })
      map.addLayer({
        id: 'map-selected-point',
        type: 'circle',
        source: 'campaign-map-features',
        filter: selectionFilter.value,
        paint: {
          'circle-radius': 7,
          'circle-color': '#e8862d',
          'circle-stroke-color': '#fff8eb',
          'circle-stroke-width': 1.5,
        },
      })

      map.on('mousemove', (event) => {
        const current = featureAt(map, event.point)
        if (!current) {
          clearHover()
          return
        }

        map.getCanvas().style.cursor = 'pointer'
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

      // MapLibre has no map-level mouseleave event; listen on the canvas container.
      map.getCanvasContainer().addEventListener('mouseleave', clearHover)

      map.on('click', (event) => {
        const target = featureAt(map, event.point)
        if (!target) return
        const properties = target.properties || {}
        const featureId = String(properties.mapFeatureId || '')
        if (!featureId) return
        const next = props.selectedFeatureIds.includes(featureId)
          ? props.selectedFeatureIds.filter((entry) => entry !== featureId)
          : [...props.selectedFeatureIds, featureId]
        emit('update:selectedFeatureIds', next)
      })

      fitMapBounds()
      map.on('zoomend', updateBackgroundScale)
      updateLayerVisibility()
      updateGlossaryFilters()
      updateSelection()
      isReady.value = true
      void updateBackground()
    })

  } catch (error) {
    if (disposed) return
    mapRef.value?.remove()
    mapRef.value = null
    mapError.value = error instanceof Error && error.name === 'GPUInitializationError'
      ? 'This map requires WebGL2. Enable browser hardware acceleration or try a supported browser.'
      : error instanceof Error ? error.message : 'Unable to initialize map viewer.'
  }
})

watch(
  () => props.activeLayers,
  () => updateLayerVisibility(),
  { deep: true }
)

watch(sourceCollection, () => {
  updateSource()
  updateGlossaryFilters()
})

watch(
  () => props.selectedFeatureIds,
  () => updateSelection(),
  { deep: true }
)

watch(
  () => props.glossaryPointsOnly,
  () => {
    updateLayerVisibility()
    updateGlossaryFilters()
  }
)

watch(mapDisplayBounds, fitMapBounds, { deep: true })
watch([() => props.svgBackgroundUrl, svgImageCoordinates], () => { void updateBackground() })

onBeforeUnmount(() => {
  disposed = true
  backgroundRequest++
  backgroundAbort?.abort()
  background = null
  mapRef.value?.getCanvasContainer().removeEventListener('mouseleave', clearHover)
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
      class="pointer-events-none fixed z-30 rounded-md border border-[var(--theme-panel-border)] px-3 py-2 text-xs shadow-xl"
      :style="{
        left: `${hoverState.x + 14}px`,
        top: `${hoverState.y + 14}px`,
        background: 'var(--theme-card-bg)',
      }"
    >
      <p class="font-semibold text-default">{{ hoverState.name }}</p>
      <p class="uppercase tracking-[0.08em] text-dimmed">{{ hoverState.type }}</p>
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
