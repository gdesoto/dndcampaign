<script setup lang="ts">
import type { DungeonMapData } from '#shared/types/dungeon'

const props = defineProps<{
  map: DungeonMapData
  selectedRoomId?: string | null
  showLabels?: boolean
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

const roomStroke = (roomId: string) => (props.selectedRoomId === roomId ? 'var(--ui-primary)' : '#94a3b8')
const corridorOuterWidth = computed(() => Math.max(8, Math.floor(props.map.cellSize * 1.05)))
const corridorInnerWidth = computed(() => Math.max(5, Math.floor(props.map.cellSize * 0.68)))
const pointToPixel = (value: number) => (value + 0.5) * props.map.cellSize
const trapPoints = computed(() =>
  props.map.traps
    .map((trap) => {
      const room = props.map.rooms.find((entry) => entry.id === trap.roomId)
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
const labeledRooms = computed(() => (props.showLabels === false ? [] : props.map.rooms))
</script>

<template>
  <UCard :ui="{ body: 'p-0' }" class="overflow-hidden">
    <div class="flex items-center justify-between border-b border-default px-3 py-2">
      <p class="text-xs text-muted">
        Zoom {{ Math.round(zoom * 100) }}% • {{ map.width }}x{{ map.height }} cells
      </p>
      <div class="flex items-center gap-1">
        <UButton size="xs" variant="ghost" icon="i-lucide-minus" @click="zoomAroundCenter(-0.1)" />
        <UButton size="xs" variant="ghost" icon="i-lucide-plus" @click="zoomAroundCenter(0.1)" />
        <UButton size="xs" variant="ghost" icon="i-lucide-locate-fixed" @click="centerMap">Center</UButton>
        <UButton size="xs" variant="ghost" icon="i-lucide-expand" @click="fitMap">Fit</UButton>
      </div>
    </div>

    <div
      ref="containerRef"
      class="relative h-[540px] touch-none overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(154,125,88,0.25),_rgba(38,30,21,0.7)_68%)]"
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
        aria-label="Dungeon map"
      >
        <g :transform="`translate(${panX} ${panY}) scale(${zoom})`">
          <rect x="0" y="0" :width="worldWidth" :height="worldHeight" fill="#1f1b16" />

          <g stroke="rgba(245, 222, 179, 0.12)" stroke-width="1">
            <line
              v-for="x in map.width"
              :key="`vx-${x}`"
              :x1="x * map.cellSize"
              y1="0"
              :x2="x * map.cellSize"
              :y2="worldHeight"
            />
            <line
              v-for="y in map.height"
              :key="`hy-${y}`"
              x1="0"
              :y1="y * map.cellSize"
              :x2="worldWidth"
              :y2="y * map.cellSize"
            />
          </g>

          <polyline
            v-for="corridor in map.corridors"
            :key="corridor.id"
            :points="corridor.points.map((point) => `${pointToPixel(point.x)} ${pointToPixel(point.y)}`).join(' ')"
            fill="none"
            stroke="#88714d"
            :stroke-width="corridorOuterWidth"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.75"
          />
          <polyline
            v-for="corridor in map.corridors"
            :key="`inner-${corridor.id}`"
            :points="corridor.points.map((point) => `${pointToPixel(point.x)} ${pointToPixel(point.y)}`).join(' ')"
            fill="none"
            stroke="#c6a979"
            :stroke-width="corridorInnerWidth"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.85"
          />

          <line
            v-for="wall in map.walls"
            :key="wall.id"
            :x1="wall.x1 * map.cellSize"
            :y1="wall.y1 * map.cellSize"
            :x2="wall.x2 * map.cellSize"
            :y2="wall.y2 * map.cellSize"
            stroke="#f8fafc"
            stroke-width="2"
          />

          <g>
            <rect
              v-for="room in map.rooms"
              :key="room.id"
              :x="room.x * map.cellSize"
              :y="room.y * map.cellSize"
              :width="room.width * map.cellSize"
              :height="room.height * map.cellSize"
              :fill="room.isSecret ? 'rgba(220, 38, 38, 0.18)' : 'rgba(226, 210, 178, 0.5)'"
              :stroke="roomStroke(room.id)"
              stroke-width="2"
              class="cursor-pointer transition-all duration-150"
              @click.stop="selectRoom(room.id)"
            />
          </g>

          <text
            v-for="room in labeledRooms"
            :key="`label-${room.id}`"
            :x="(room.x + Math.floor(room.width / 2)) * map.cellSize"
            :y="(room.y + Math.floor(room.height / 2)) * map.cellSize"
            fill="#f5f0e6"
            font-size="12"
            text-anchor="middle"
            dominant-baseline="middle"
          >
            {{ room.roomNumber }}
          </text>

          <circle
            v-for="door in map.doors"
            :key="door.id"
            :cx="pointToPixel(door.x)"
            :cy="pointToPixel(door.y)"
            r="5"
            :fill="door.isSecret ? '#f59e0b' : (door.isLocked ? '#ef4444' : '#10b981')"
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
          :width="180"
          :height="180"
          class="block cursor-crosshair"
          @pointerdown="onMinimapPointerDown"
          @pointermove="onMinimapPointerMove"
          @pointerup="onMinimapPointerUp"
          @pointerleave="onMinimapPointerUp"
        >
          <rect
            x="0"
            y="0"
            :width="worldWidth * minimapScale"
            :height="worldHeight * minimapScale"
            fill="#0f172a"
            stroke="#334155"
          />
          <rect
            v-for="room in map.rooms"
            :key="`mini-${room.id}`"
            :x="room.x * map.cellSize * minimapScale"
            :y="room.y * map.cellSize * minimapScale"
            :width="room.width * map.cellSize * minimapScale"
            :height="room.height * map.cellSize * minimapScale"
            :fill="room.isSecret ? 'rgba(248,113,113,0.35)' : 'rgba(148,163,184,0.35)'"
          />
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
