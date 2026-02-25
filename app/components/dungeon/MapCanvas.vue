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
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const panStart = ref({ x: 0, y: 0 })
const viewport = reactive({ width: 1, height: 1 })

let observer: ResizeObserver | null = null

onMounted(() => {
  if (!containerRef.value || !import.meta.client) return
  observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (!rect) return
    viewport.width = Math.max(1, rect.width)
    viewport.height = Math.max(1, rect.height)
  })
  observer.observe(containerRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

watch(
  () => props.map,
  () => {
    zoom.value = 1
    panX.value = 0
    panY.value = 0
  },
  { deep: false },
)

const worldWidth = computed(() => props.map.width * props.map.cellSize)
const worldHeight = computed(() => props.map.height * props.map.cellSize)

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

const changeZoom = (delta: number) => {
  const next = Math.max(0.35, Math.min(3, zoom.value + delta))
  zoom.value = Number(next.toFixed(2))
}

const onWheel = (event: WheelEvent) => {
  event.preventDefault()
  changeZoom(event.deltaY > 0 ? -0.1 : 0.1)
}

const beginDrag = (event: PointerEvent) => {
  dragging.value = true
  dragStart.value = { x: event.clientX, y: event.clientY }
  panStart.value = { x: panX.value, y: panY.value }
}

const onDrag = (event: PointerEvent) => {
  if (!dragging.value) return
  panX.value = panStart.value.x + (event.clientX - dragStart.value.x)
  panY.value = panStart.value.y + (event.clientY - dragStart.value.y)
}

const endDrag = () => {
  dragging.value = false
}

const centerMap = () => {
  panX.value = (viewport.width - worldWidth.value * zoom.value) / 2
  panY.value = (viewport.height - worldHeight.value * zoom.value) / 2
}

const selectRoom = (roomId: string) => {
  emit('update:selectedRoomId', props.selectedRoomId === roomId ? null : roomId)
}

const roomStroke = (roomId: string) => (props.selectedRoomId === roomId ? 'var(--ui-primary)' : '#94a3b8')
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
        <UButton size="xs" variant="ghost" icon="i-lucide-minus" @click="changeZoom(-0.1)" />
        <UButton size="xs" variant="ghost" icon="i-lucide-plus" @click="changeZoom(0.1)" />
        <UButton size="xs" variant="ghost" icon="i-lucide-locate-fixed" @click="centerMap">Center</UButton>
      </div>
    </div>

    <div
      ref="containerRef"
      class="relative h-[540px] touch-none overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.12),_transparent_55%)]"
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
          <rect x="0" y="0" :width="worldWidth" :height="worldHeight" fill="#0f172a" />

          <g stroke="#1e293b" stroke-width="1">
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
            :points="corridor.points.map((point) => `${point.x * map.cellSize} ${point.y * map.cellSize}`).join(' ')"
            fill="none"
            stroke="#22d3ee"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.7"
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
              :fill="room.isSecret ? 'rgba(248,113,113,0.2)' : 'rgba(203,213,225,0.18)'"
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
            fill="#e2e8f0"
            font-size="12"
            text-anchor="middle"
            dominant-baseline="middle"
          >
            {{ room.roomNumber }}
          </text>

          <circle
            v-for="door in map.doors"
            :key="door.id"
            :cx="door.x * map.cellSize"
            :cy="door.y * map.cellSize"
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

      <div class="pointer-events-none absolute bottom-3 right-3 rounded-md border border-default bg-default/90 p-2 backdrop-blur">
        <svg :width="180" :height="180" class="block">
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
