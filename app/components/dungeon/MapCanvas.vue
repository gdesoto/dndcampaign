<script setup lang="ts">
import type { ExpressionSpecification, GeoJSONSource, ImageSource, Map as MapLibreMap, PointLike } from 'maplibre-gl'
import type { DungeonMapData } from '#shared/types/dungeon'
import { renderDungeonSvg } from '#shared/utils/dungeon-render'
import { decodeSvgRaster } from '~/components/maps/svg-background'
import {
  dungeonCellToLngLat, dungeonImageCoordinates, dungeonMapBounds, dungeonMapFeatures, dungeonMarkerColors,
  type DungeonMarkerSelection,
} from '~/utils/dungeon-map-features'

const props = withDefaults(defineProps<{
  map: DungeonMapData
  floor?: number
  selectedRoomId?: string | null
  selectedMarker?: DungeonMarkerSelection | null
  showLabels?: boolean
  showGrid?: boolean
  showRoute?: boolean
}>(), {
  floor: 0,
  selectedRoomId: null,
  selectedMarker: null,
  showLabels: true,
  showGrid: true,
  showRoute: false,
})

const emit = defineEmits<{
  'update:selectedRoomId': [value: string | null]
  'update:selectedMarker': [value: DungeonMarkerSelection | null]
}>()

const rootRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const mapRef = shallowRef<MapLibreMap | null>(null)
const isReady = ref(false)
const mapError = ref('')
let disposed = false
let raster: Awaited<ReturnType<typeof decodeSvgRaster>> | null = null
let rasterRequest = 0
let rasterScale = 0
// Canvas sides beyond this exceed common GPU texture limits.
const MAX_RASTER_SIDE = 8192

const floor = computed(() => props.floor)
const mapName = computed(() => props.map.mapType === 'FOREST' ? 'Forest encounter' : props.map.mapType === 'BUILDING' ? 'Building' : 'Dungeon')
const floorName = computed(() => props.map.floorLabels?.[floor.value] || `floor ${floor.value + 1}`)
const mapLabel = computed(() => `${mapName.value} map, ${floorName.value}`)
const svg = computed(() => renderDungeonSvg(props.map, {
  floor: floor.value,
  includeLabels: props.showLabels,
  includeGrid: props.showGrid,
  includeFlow: props.showRoute,
  // The legend popover explains symbols, so the image needs no built-in key.
  includeKey: false,
}))
const features = computed(() => dungeonMapFeatures(props.map, floor.value))
const bounds = computed(() => dungeonMapBounds(props.map))

const idFilter = (id: string | null | undefined): ExpressionSpecification => ['==', ['get', 'id'], id ?? '']

const FIT_PADDING = 24
// Until the user pans or zooms, resizes (including fullscreen) refit the map.
let userMoved = false

const fit = (animate = true) => {
  const map = mapRef.value
  if (!map) return
  userMoved = false
  map.fitBounds(bounds.value, { padding: FIT_PADDING, duration: animate ? 300 : 0 })
}

/**
 * MapLibre zooms in until the viewport fits inside maxBounds, so the bounds
 * must cover the fitted view at the container's aspect ratio, plus pan room.
 */
const constrainCamera = () => {
  const map = mapRef.value
  if (!map) return
  map.setMaxBounds(null)
  const fitZoom = map.cameraForBounds(bounds.value, { padding: FIT_PADDING })?.zoom
  if (fitZoom === undefined) return
  const [[west, south], [east, north]] = bounds.value
  const degreesPerPixel = 360 / (512 * 2 ** fitZoom)
  const container = map.getContainer()
  const halfWidth = Math.max(east - west, container.clientWidth * degreesPerPixel) * 0.75
  const halfHeight = Math.max(north - south, container.clientHeight * degreesPerPixel) * 0.75
  const centerX = (west + east) / 2
  const centerY = (south + north) / 2
  map.setMaxBounds([[centerX - halfWidth, centerY - halfHeight], [centerX + halfWidth, centerY + halfHeight]])
  map.setMaxZoom(fitZoom + 5)
}

/** Rasterize at roughly the on-screen resolution, in power-of-two steps. */
const updateRasterScale = (force = false) => {
  const map = mapRef.value
  const source = map?.getSource<ImageSource>('dungeon-raster')
  if (!map || !source || !raster) return
  const [[west], [east]] = bounds.value
  const displayedWidth = 512 * 2 ** map.getZoom() * (east - west) / 360 * (window.devicePixelRatio || 1)
  const ceiling = MAX_RASTER_SIDE / Math.max(raster.width, raster.height)
  const scale = Math.min(ceiling, 4, Math.max(0.25, 2 ** Math.ceil(Math.log2(displayedWidth / raster.width))))
  if (!force && scale === rasterScale) return
  source.updateImage({ image: raster.rasterize(scale), coordinates: dungeonImageCoordinates(props.map) })
  rasterScale = scale
}

const updateRaster = async () => {
  if (!mapRef.value || !isReady.value) return
  const request = ++rasterRequest
  try {
    const decoded = await decodeSvgRaster(new Blob([svg.value], { type: 'image/svg+xml' }))
    if (disposed || request !== rasterRequest) return
    raster = decoded
    updateRasterScale(true)
    mapRef.value?.setLayoutProperty('dungeon-raster', 'visibility', 'visible')
  } catch (error) {
    if (!disposed && request === rasterRequest) mapError.value = error instanceof Error ? error.message : 'Unable to draw the map.'
  }
}

const updateSelection = () => {
  const map = mapRef.value
  if (!map || !isReady.value) return
  map.setFilter('room-selected-fill', idFilter(props.selectedRoomId))
  map.setFilter('room-selected-line', idFilter(props.selectedRoomId))
  map.setFilter('marker-selected', idFilter(props.selectedMarker?.id))
}

/** Bring a selection made outside the map, such as from a list, into view. */
const revealSelection = () => {
  const map = mapRef.value
  if (!map || !isReady.value) return
  const id = props.selectedMarker?.id || props.selectedRoomId
  const feature = id && features.value.features.find(item => item.properties.id === id)
  if (!feature) return
  const coordinates = feature.geometry.type === 'Point'
    ? feature.geometry.coordinates as [number, number]
    : feature.geometry.coordinates[0]![0] as [number, number]
  if (!map.getBounds().contains(coordinates)) {
    const target = feature.geometry.type === 'Point'
      ? coordinates
      : (() => {
          const room = props.map.rooms.find(item => item.id === id)!
          return dungeonCellToLngLat(props.map, room.x + room.width / 2, room.y + room.height / 2)
        })()
    map.easeTo({ center: target, duration: 300 })
  }
}

const interactiveLayers = ['marker-points', 'door-targets', 'room-targets']
const featureAt = (map: MapLibreMap, point: PointLike) => {
  const found = map.queryRenderedFeatures(point, { layers: interactiveLayers })
  return found.find(item => item.properties.kind !== 'room') || found[0]
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
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#262019' } }],
      },
      bounds: bounds.value,
      fitBoundsOptions: { padding: FIT_PADDING },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      renderWorldCopies: false,
    })
    mapRef.value = map
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    if (rootRef.value) map.addControl(new maplibregl.FullscreenControl({ container: rootRef.value }), 'top-right')
    map.getCanvas().setAttribute('aria-label', mapLabel.value)

    map.on('load', () => {
      if (disposed) return
      map.addSource('dungeon-raster', { type: 'image', coordinates: dungeonImageCoordinates(props.map) } as never)
      map.addLayer({
        id: 'dungeon-raster',
        type: 'raster',
        source: 'dungeon-raster',
        layout: { visibility: 'none' },
        paint: { 'raster-fade-duration': 0 },
      })
      map.addSource('dungeon-features', { type: 'geojson', data: features.value })
      map.addLayer({
        id: 'room-targets',
        type: 'fill',
        source: 'dungeon-features',
        filter: ['==', ['get', 'kind'], 'room'],
        paint: { 'fill-color': '#000000', 'fill-opacity': 0 },
      })
      map.addLayer({
        id: 'room-selected-fill',
        type: 'fill',
        source: 'dungeon-features',
        filter: idFilter(props.selectedRoomId),
        paint: { 'fill-color': '#b8872e', 'fill-opacity': 0.18 },
      })
      map.addLayer({
        id: 'room-selected-line',
        type: 'line',
        source: 'dungeon-features',
        filter: idFilter(props.selectedRoomId),
        paint: { 'line-color': '#d4a03c', 'line-width': 3 },
      })
      map.addLayer({
        id: 'door-targets',
        type: 'circle',
        source: 'dungeon-features',
        filter: ['==', ['get', 'kind'], 'door'],
        paint: { 'circle-radius': 9, 'circle-opacity': 0 },
      })
      map.addLayer({
        id: 'marker-points',
        type: 'circle',
        source: 'dungeon-features',
        filter: ['in', ['get', 'kind'], ['literal', ['trap', 'encounter', 'treasure']]],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3, 12, 7],
          'circle-color': ['match', ['get', 'kind'], 'trap', dungeonMarkerColors.trap, 'encounter', dungeonMarkerColors.encounter, dungeonMarkerColors.treasure],
          'circle-stroke-color': '#2b2116',
          'circle-stroke-width': 1.5,
        },
      })
      map.addLayer({
        id: 'marker-selected',
        type: 'circle',
        source: 'dungeon-features',
        filter: idFilter(props.selectedMarker?.id),
        paint: { 'circle-radius': 11, 'circle-opacity': 0, 'circle-stroke-color': '#38bdf8', 'circle-stroke-width': 3 },
      })

      map.on('mousemove', (event) => {
        map.getCanvas().style.cursor = featureAt(map, event.point) ? 'pointer' : ''
      })
      map.on('click', (event) => {
        const target = featureAt(map, event.point)
        const kind = target?.properties.kind as string | undefined
        const id = String(target?.properties.id ?? '')
        if (!target || !id) {
          emit('update:selectedMarker', null)
          emit('update:selectedRoomId', null)
        } else if (kind === 'room') {
          emit('update:selectedMarker', null)
          emit('update:selectedRoomId', props.selectedRoomId === id ? null : id)
        } else {
          emit('update:selectedMarker', props.selectedMarker?.id === id ? null : { kind: kind as DungeonMarkerSelection['kind'], id })
        }
      })
      map.on('zoomend', () => updateRasterScale())
      // Only user gestures carry an originalEvent; programmatic fits do not.
      for (const event of ['dragstart', 'zoomstart'] as const) {
        map.on(event, (change) => { if (change.originalEvent) userMoved = true })
      }
      map.on('resize', () => {
        constrainCamera()
        if (!userMoved) fit(false)
      })

      constrainCamera()
      fit(false)
      isReady.value = true
      void updateRaster()
    })
  } catch (error) {
    if (disposed) return
    mapRef.value?.remove()
    mapRef.value = null
    mapError.value = error instanceof Error && error.name === 'GPUInitializationError'
      ? 'This map requires WebGL2. Enable browser hardware acceleration or try a supported browser.'
      : error instanceof Error ? error.message : 'Unable to initialize the map.'
  }
})

watch(svg, () => { void updateRaster() })
watch(features, (data) => {
  mapRef.value?.getSource<GeoJSONSource>('dungeon-features')?.setData(data)
})
// A different grid size invalidates the camera; same-size edits keep the user's view.
watch(() => [props.map.width, props.map.height], () => {
  if (!isReady.value) return
  mapRef.value?.getSource<ImageSource>('dungeon-raster')?.setCoordinates(dungeonImageCoordinates(props.map))
  constrainCamera()
  fit(false)
})
watch(() => [props.selectedRoomId, props.selectedMarker?.id], () => {
  updateSelection()
  revealSelection()
})
watch(mapLabel, label => mapRef.value?.getCanvas().setAttribute('aria-label', label))

onBeforeUnmount(() => {
  disposed = true
  rasterRequest++
  raster = null
  mapRef.value?.remove()
  mapRef.value = null
})

defineExpose({ fit })
</script>

<template>
  <div ref="rootRef" class="flex flex-col overflow-hidden rounded-lg border border-default bg-default">
    <slot name="toolbar" />
    <div class="relative min-h-80 flex-1">
      <div
        ref="containerRef"
        class="h-[min(70dvh,48rem)] min-h-80 w-full in-[:fullscreen]:h-full"
      />
      <div v-if="!isReady && !mapError" class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
        Loading map…
      </div>
      <div v-if="mapError" role="alert" class="absolute inset-0 flex items-center justify-center bg-default/80 p-4 text-sm text-error">
        {{ mapError }}
      </div>
    </div>
  </div>
</template>
