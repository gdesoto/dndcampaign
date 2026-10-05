<script setup lang="ts">
import type { DungeonMapData } from '#shared/types/dungeon'
import { getDungeonFloorMap } from '#shared/utils/dungeon-map'
import { renderDungeonSvg } from '#shared/utils/dungeon-render'

const props = defineProps<{
  map: DungeonMapData
  selectedRoomId?: string | null
  showLabels?: boolean
  floor?: number
  showRoute?: boolean
}>()

const emit = defineEmits<{
  'update:selectedRoomId': [value: string | null]
}>()

const containerRef = ref<HTMLElement | null>(null)
const miniMapRef = ref<SVGSVGElement | null>(null)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const dragging = ref(false)
const minimapDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const panStart = ref({ x: 0, y: 0 })
const viewport = reactive({ width: 1, height: 1 })
const ZOOM_MAX = 4

let observer: ResizeObserver | null = null

onMounted(() => {
  if (!containerRef.value || !import.meta.client) return
  observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (!rect) return
    viewport.width = Math.max(1, rect.width)
    viewport.height = Math.max(1, rect.height)
    if (!dragging.value) fitMap()
  })
  observer.observe(containerRef.value)
  fitMap()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

watch(
  () => props.map,
  () => {
    fitMap()
  },
  { deep: false },
)

const worldWidth = computed(() => props.map.width * props.map.cellSize)
const worldHeight = computed(() => props.map.height * props.map.cellSize)
const fitZoom = computed(() =>
  Math.min(
    viewport.width / Math.max(1, worldWidth.value),
    viewport.height / Math.max(1, worldHeight.value),
  ),
)
const minZoom = computed(() => Math.max(0.05, fitZoom.value * 0.5))

const minimapScale = computed(() => {
  const maxSide = Math.max(worldWidth.value, worldHeight.value, 1)
  return 180 / maxSide
})

const viewportWorld = computed(() => {
  const x = -panX.value / zoom.value
  const y = -panY.value / zoom.value
  const width = viewport.width / zoom.value
  const height = viewport.height / zoom.value
  return { x, y, width, height }
})

const clampZoom = (next: number) =>
  Math.max(minZoom.value, Math.min(ZOOM_MAX, Number(next.toFixed(3))))

const clampPan = (nextX: number, nextY: number, currentZoom = zoom.value) => {
  const scaledWidth = worldWidth.value * currentZoom
  const scaledHeight = worldHeight.value * currentZoom
  const minX = Math.min(0, viewport.width - scaledWidth)
  const minY = Math.min(0, viewport.height - scaledHeight)
  const maxX = scaledWidth <= viewport.width ? (viewport.width - scaledWidth) / 2 : 0
  const maxY = scaledHeight <= viewport.height ? (viewport.height - scaledHeight) / 2 : 0
  return {
    x: Math.min(maxX, Math.max(minX, nextX)),
    y: Math.min(maxY, Math.max(minY, nextY)),
  }
}

const setPan = (nextX: number, nextY: number, currentZoom = zoom.value) => {
  const clamped = clampPan(nextX, nextY, currentZoom)
  panX.value = clamped.x
  panY.value = clamped.y
}

const centerMap = () => {
  setPan(
    (viewport.width - worldWidth.value * zoom.value) / 2,
    (viewport.height - worldHeight.value * zoom.value) / 2,
  )
}

const fitMap = () => {
  zoom.value = clampZoom(fitZoom.value)
  centerMap()
}

const applyZoom = (nextZoom: number, clientX?: number, clientY?: number) => {
  const targetZoom = clampZoom(nextZoom)
  if (targetZoom === zoom.value) return
  if (!containerRef.value || clientX === undefined || clientY === undefined) {
    zoom.value = targetZoom
    centerMap()
    return
  }

  const bounds = containerRef.value.getBoundingClientRect()
  const anchorX = clientX - bounds.left
  const anchorY = clientY - bounds.top
  const worldX = (anchorX - panX.value) / zoom.value
  const worldY = (anchorY - panY.value) / zoom.value
  zoom.value = targetZoom
  setPan(anchorX - worldX * targetZoom, anchorY - worldY * targetZoom, targetZoom)
}

const changeZoom = (delta: number, clientX?: number, clientY?: number) => {
  applyZoom(zoom.value + delta, clientX, clientY)
}

const zoomAroundCenter = (delta: number) => {
  if (!containerRef.value) {
    changeZoom(delta)
    return
  }
  const bounds = containerRef.value.getBoundingClientRect()
  changeZoom(delta, bounds.left + (bounds.width / 2), bounds.top + (bounds.height / 2))
}

const onWheel = (event: WheelEvent) => {
  event.preventDefault()
  changeZoom(event.deltaY > 0 ? -0.1 : 0.1, event.clientX, event.clientY)
}

const beginDrag = (event: PointerEvent) => {
  dragging.value = true
  dragStart.value = { x: event.clientX, y: event.clientY }
  panStart.value = { x: panX.value, y: panY.value }
}

const onDrag = (event: PointerEvent) => {
  if (!dragging.value) return
  setPan(
    panStart.value.x + (event.clientX - dragStart.value.x),
    panStart.value.y + (event.clientY - dragStart.value.y),
  )
}

const endDrag = () => {
  dragging.value = false
}

const moveViewportToWorldPoint = (worldX: number, worldY: number) => {
  setPan(
    viewport.width / 2 - worldX * zoom.value,
    viewport.height / 2 - worldY * zoom.value,
  )
}

const onMinimapPointerDown = (event: PointerEvent) => {
  if (!miniMapRef.value) return
  event.preventDefault()
  event.stopPropagation()
  minimapDragging.value = true
  const bounds = miniMapRef.value.getBoundingClientRect()
  const localX = Math.min(180, Math.max(0, event.clientX - bounds.left))
  const localY = Math.min(180, Math.max(0, event.clientY - bounds.top))
  moveViewportToWorldPoint(localX / minimapScale.value, localY / minimapScale.value)
}

const onMinimapPointerMove = (event: PointerEvent) => {
  if (!minimapDragging.value || !miniMapRef.value) return
  event.preventDefault()
  event.stopPropagation()
  const bounds = miniMapRef.value.getBoundingClientRect()
  const localX = Math.min(180, Math.max(0, event.clientX - bounds.left))
  const localY = Math.min(180, Math.max(0, event.clientY - bounds.top))
  moveViewportToWorldPoint(localX / minimapScale.value, localY / minimapScale.value)
}

const onMinimapPointerUp = () => {
  minimapDragging.value = false
}

const selectRoom = (roomId: string) => {
  emit('update:selectedRoomId', props.selectedRoomId === roomId ? null : roomId)
}

const floorMap = computed(() => getDungeonFloorMap(props.map, props.floor ?? 0))
const mapSvg = computed(() => renderDungeonSvg(props.map, { floor: props.floor, includeLabels: props.showLabels, includeFlow: props.showRoute }))
const minimapSvg = computed(() => renderDungeonSvg(props.map, { floor: props.floor, includeGrid: false, includeLabels: false }))
const mapName = computed(() => props.map.mapType === 'FOREST' ? 'Forest encounter' : props.map.mapType === 'BUILDING' ? 'Building' : 'Dungeon')
const trapPoints = computed(() =>
  floorMap.value.traps
    .map((trap) => {
      const room = floorMap.value.rooms.find((entry) => entry.id === trap.roomId)
      if (!room) return null
      const baseX = room.x * props.map.cellSize
      const baseY = room.y * props.map.cellSize
      return {
        id: trap.id,
        points: `${baseX + 4},${baseY + 4} ${baseX + 12},${baseY + 4} ${baseX + 8},${baseY + 11}`,
      }
    })
    .filter((item): item is { id: string; points: string } => Boolean(item)),
)
const mapHelpId = useId()
const onMapKeydown = (event: KeyboardEvent) => {
  if (event.target !== event.currentTarget) return
  const step = event.shiftKey ? 100 : 40
  if (event.key === 'ArrowLeft') setPan(panX.value + step, panY.value)
  else if (event.key === 'ArrowRight') setPan(panX.value - step, panY.value)
  else if (event.key === 'ArrowUp') setPan(panX.value, panY.value + step)
  else if (event.key === 'ArrowDown') setPan(panX.value, panY.value - step)
  else if (event.key === '+' || event.key === '=') zoomAroundCenter(0.1)
  else if (event.key === '-') zoomAroundCenter(-0.1)
  else if (event.key === 'Home') fitMap()
  else return
  event.preventDefault()
}
</script>

<template>
  <UCard :ui="{ body: 'p-0' }" class="overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default px-3 py-2">
      <p class="text-xs text-muted">
        Zoom {{ Math.round(zoom * 100) }}% • {{ map.width }}x{{ map.height }} cells
      </p>
      <div class="flex items-center gap-1">
        <UButton size="xs" variant="ghost" icon="i-lucide-minus" aria-label="Zoom out" @click="zoomAroundCenter(-0.1)" />
        <UButton size="xs" variant="ghost" icon="i-lucide-plus" aria-label="Zoom in" @click="zoomAroundCenter(0.1)" />
        <UButton size="xs" variant="ghost" icon="i-lucide-locate-fixed" @click="centerMap">Center</UButton>
        <UButton size="xs" variant="ghost" icon="i-lucide-expand" @click="fitMap">Fit</UButton>
      </div>
    </div>

    <div class="space-y-2 border-b border-default p-3">
      <USelect
        :aria-label="map.mapType === 'FOREST' ? 'Select encounter area' : map.mapType === 'BUILDING' ? 'Select building room' : 'Select dungeon room'"
        :model-value="selectedRoomId || '__none__'"
        :items="[{ label: 'No room selected', value: '__none__' }, ...floorMap.rooms.map(room => ({ label: room.label ? `${room.roomNumber} · ${room.label}` : `Room ${room.roomNumber}`, value: room.id }))]"
        @update:model-value="value => emit('update:selectedRoomId', value === '__none__' ? null : value)" />
      <p :id="mapHelpId" class="text-xs text-muted">Focus the map to pan with arrow keys, zoom with + or −, and fit with Home.</p>
    </div>
    <div
      ref="containerRef"
      tabindex="0"
      role="region"
      :aria-label="`${mapName} map controls`"
      :aria-describedby="mapHelpId"
      class="relative h-[540px] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 touch-none overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(154,125,88,0.25),_rgba(38,30,21,0.7)_68%)]"
      @keydown="onMapKeydown"
      @wheel="onWheel"
      @pointerdown="beginDrag"
      @pointermove="onDrag"
      @pointerup="endDrag"
      @pointerleave="endDrag"
    >
      <svg
        class="h-full w-full"
        :style="{ cursor: dragging ? 'grabbing' : 'grab' }"
        role="img"
        :aria-label="`${mapName} map, ${map.floorLabels?.[floor ?? 0] || `floor ${(floor ?? 0) + 1}`}`"
      >
        <g :transform="`translate(${panX} ${panY}) scale(${zoom})`">
          <!-- renderDungeonSvg escapes every text and attribute value. -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <g class="pointer-events-none" v-html="mapSvg" />
          <rect
            v-for="room in floorMap.rooms"
            :key="room.id"
            :x="room.x * map.cellSize"
            :y="room.y * map.cellSize"
            :width="room.width * map.cellSize"
            :height="room.height * map.cellSize"
            :fill="selectedRoomId === room.id ? 'rgba(184, 135, 46, 0.18)' : 'transparent'"
            :stroke="selectedRoomId === room.id ? 'var(--ui-primary)' : 'none'"
            :stroke-width="3"
            class="cursor-pointer"
            @click.stop="selectRoom(room.id)"
          />

          <g v-for="trap in trapPoints" :key="trap.id">
            <polygon
              :points="trap.points"
              fill="#f97316"
            />
          </g>
        </g>
      </svg>

      <div class="absolute bottom-3 right-3 rounded-md border border-default bg-default/90 p-2 backdrop-blur">
        <svg
          ref="miniMapRef"
          role="img"
          :aria-label="`${mapName} overview; use the map controls to pan with the keyboard`"
          :width="180"
          :height="180"
          class="block cursor-crosshair"
          @pointerdown="onMinimapPointerDown"
          @pointermove="onMinimapPointerMove"
          @pointerup="onMinimapPointerUp"
          @pointerleave="onMinimapPointerUp"
        >
          <!-- eslint-disable-next-line vue/no-v-html -->
          <g :transform="`scale(${minimapScale})`" class="pointer-events-none" v-html="minimapSvg" />
          <rect
            :x="viewportWorld.x * minimapScale"
            :y="viewportWorld.y * minimapScale"
            :width="viewportWorld.width * minimapScale"
            :height="viewportWorld.height * minimapScale"
            fill="none"
            stroke="#38bdf8"
            stroke-width="1.5"
          />
        </svg>
      </div>
    </div>
  </UCard>
</template>
