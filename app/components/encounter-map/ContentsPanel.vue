<script setup lang="ts">
import type { EncounterMapPatchActionInput } from '#shared/schemas/encounter-map'
import type { CampaignEncounterMapRoom, EncounterMapData } from '#shared/types/encounter-map'
import type { EncounterMapMarkerKind, EncounterMapMarkerSelection } from '~/utils/encounter-map-features'

const props = defineProps<{
  floorMap: EncounterMapData
  floor: number
  rooms: CampaignEncounterMapRoom[]
  selectedRoomId: string | null
  selectedMarker: EncounterMapMarkerSelection | null
  busy: boolean
  canWrite: boolean
}>()
const emit = defineEmits<{
  'select-room': [roomId: string]
  'select-marker': [selection: EncounterMapMarkerSelection]
  'patch': [actions: EncounterMapPatchActionInput[]]
}>()

type Section = 'rooms' | 'corridors' | 'doors' | 'traps' | 'encounters' | 'treasure' | 'zones'
const section = ref<Section>('rooms')
const sectionByMarker: Record<EncounterMapMarkerKind, Section> = { door: 'doors', trap: 'traps', encounter: 'encounters', treasure: 'treasure' }
watch(() => props.selectedMarker, (marker) => { if (marker) section.value = sectionByMarker[marker.kind] }, { immediate: true })

const isForest = computed(() => props.floorMap.mapType === 'FOREST')
const roomName = (roomId: string) => {
  const room = props.floorMap.rooms.find(item => item.id === roomId)
  if (!room) return 'Unknown room'
  const saved = props.rooms.find(item => item.roomNumber === room.roomNumber)?.name
  return saved || room.label || `${isForest.value ? 'Clearing' : 'Room'} ${room.roomNumber}`
}
const sections = computed(() => [
  { label: isForest.value ? 'Clearings' : 'Rooms', value: 'rooms' as const, badge: props.floorMap.rooms.length },
  { label: isForest.value ? 'Trails' : 'Passages', value: 'corridors' as const, badge: props.floorMap.corridors.length },
  { label: 'Doors', value: 'doors' as const, badge: props.floorMap.doors.length },
  { label: 'Traps', value: 'traps' as const, badge: props.floorMap.traps.length },
  { label: 'Encounters', value: 'encounters' as const, badge: props.floorMap.encounters.length },
  { label: 'Treasure', value: 'treasure' as const, badge: props.floorMap.treasures.length },
  { label: 'Zones', value: 'zones' as const, badge: props.floorMap.zones.length },
])
const doorRooms = (corridorId: string) => {
  const corridor = props.floorMap.corridors.find(item => item.id === corridorId)
  return corridor ? `${roomName(corridor.fromRoomId)} ↔ ${roomName(corridor.toRoomId)}` : 'Unconnected door'
}
const pinnable = computed(() => {
  if (section.value === 'traps') {
    return props.floorMap.traps.map(item => ({
      id: item.id, kind: 'trap' as const, entityType: 'TRAP' as const, isLocked: item.isLocked,
      title: item.name, detail: `${roomName(item.roomId)} · DC ${item.detectDc}/${item.disarmDc}`, badge: item.severity,
    }))
  }
  if (section.value === 'encounters') {
    return props.floorMap.encounters.map(item => ({
      id: item.id, kind: 'encounter' as const, entityType: 'ENCOUNTER' as const, isLocked: item.isLocked,
      title: item.title, detail: roomName(item.roomId), badge: item.difficulty,
    }))
  }
  if (section.value === 'treasure') {
    return props.floorMap.treasures.map(item => ({
      id: item.id, kind: 'treasure' as const, entityType: 'TREASURE' as const, isLocked: item.isLocked,
      title: item.summary, detail: roomName(item.roomId), badge: item.rarity.replace('_', ' '),
    }))
  }
  return []
})
const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()

const addRoomOpen = ref(false)
const newRoom = reactive({ x: 1, y: 1, width: 6, height: 6 })
const addRoom = () => {
  emit('patch', [{ type: 'ADD_ROOM', floor: props.floor, ...newRoom, isSecret: false }])
  addRoomOpen.value = false
}
const rowClass = (selected: boolean) => [
  'flex w-full min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-elevated',
  selected ? 'border-primary bg-elevated' : 'border-default',
]
</script>

<template>
  <div class="space-y-3">
    <UTabs v-model="section" :items="sections" :content="false" size="xs" variant="link" :ui="{ list: 'flex-wrap', trigger: 'flex-none' }" />

    <template v-if="section === 'rooms'">
      <div v-if="canWrite" class="flex flex-wrap gap-2">
        <UPopover v-model:open="addRoomOpen">
          <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-square-plus" :disabled="busy">Add {{ isForest ? 'clearing' : 'room' }}</UButton>
          <template #content>
            <form class="grid w-64 grid-cols-2 gap-2 p-3" @submit.prevent="addRoom">
              <UFormField label="X"><UInputNumber v-model="newRoom.x" :min="0" class="w-full" /></UFormField>
              <UFormField label="Y"><UInputNumber v-model="newRoom.y" :min="0" class="w-full" /></UFormField>
              <UFormField label="Width"><UInputNumber v-model="newRoom.width" :min="2" :max="80" class="w-full" /></UFormField>
              <UFormField label="Height"><UInputNumber v-model="newRoom.height" :min="2" :max="80" class="w-full" /></UFormField>
              <UButton type="submit" class="col-span-2 justify-center">Add to this floor</UButton>
            </form>
          </template>
        </UPopover>
        <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-list-ordered" :disabled="busy" @click="emit('patch', [{ type: 'RENUMBER_ROOMS', mode: 'AUTO' }])">
          Renumber
        </UButton>
      </div>
      <ul class="space-y-1.5">
        <li v-for="room in floorMap.rooms" :key="room.id">
          <button type="button" :class="rowClass(selectedRoomId === room.id)" :aria-pressed="selectedRoomId === room.id" @click="emit('select-room', room.id)">
            <span class="w-6 shrink-0 font-mono text-xs text-muted">{{ room.roomNumber }}</span>
            <span class="min-w-0 flex-1 truncate">{{ roomName(room.id) }}</span>
            <UBadge v-if="room.isSecret" color="warning" variant="subtle" size="sm">Secret</UBadge>
            <span class="shrink-0 text-xs tabular-nums text-muted">{{ room.width }} × {{ room.height }}</span>
          </button>
        </li>
      </ul>
    </template>

    <ul v-else-if="section === 'corridors'" class="space-y-1.5 text-sm">
      <li v-for="corridor in floorMap.corridors" :key="corridor.id" class="flex items-center gap-2 rounded-md border border-default px-3 py-2">
        <span class="min-w-0 flex-1 truncate">{{ roomName(corridor.fromRoomId) }} → {{ roomName(corridor.toRoomId) }}</span>
        <UBadge v-if="corridor.kind === 'BRIDGE'" color="neutral" variant="subtle" size="sm">Bridge</UBadge>
      </li>
    </ul>

    <ul v-else-if="section === 'doors'" class="space-y-1.5">
      <li v-for="door in floorMap.doors" :key="door.id" class="flex items-center gap-1">
        <button type="button" :class="rowClass(selectedMarker?.id === door.id)" :aria-pressed="selectedMarker?.id === door.id" @click="emit('select-marker', { kind: 'door', id: door.id })">
          <span class="min-w-0 flex-1 truncate">{{ doorRooms(door.corridorId) }}</span>
          <UBadge v-if="door.isLocked" color="neutral" variant="subtle" size="sm">Locked</UBadge>
          <UBadge v-if="door.isSecret" color="warning" variant="subtle" size="sm">Secret</UBadge>
        </button>
        <template v-if="canWrite">
          <UTooltip :text="door.isLocked ? 'Unlock door' : 'Lock door'">
            <UButton
              size="sm" color="neutral" variant="ghost" :icon="door.isLocked ? 'i-lucide-lock' : 'i-lucide-lock-open'"
              :aria-label="`Locked door: ${doorRooms(door.corridorId)}`" :aria-pressed="door.isLocked" :disabled="busy"
              @click="emit('patch', [{ type: 'TOGGLE_DOOR_LOCK', doorId: door.id }])"
            />
          </UTooltip>
          <UTooltip :text="door.isSecret ? 'Reveal door' : 'Make secret'">
            <UButton
              size="sm" color="neutral" variant="ghost" :icon="door.isSecret ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :aria-label="`Secret door: ${doorRooms(door.corridorId)}`" :aria-pressed="door.isSecret" :disabled="busy"
              @click="emit('patch', [{ type: 'TOGGLE_DOOR_SECRET', doorId: door.id }])"
            />
          </UTooltip>
        </template>
      </li>
    </ul>

    <ul v-else-if="section === 'zones'" class="space-y-1.5 text-sm">
      <li v-for="zone in floorMap.zones" :key="zone.id" class="flex items-center gap-2 rounded-md border border-default px-3 py-2">
        <UBadge :color="zone.type === 'HAZARD' ? 'error' : zone.type === 'SAFE' ? 'success' : 'neutral'" variant="subtle" size="sm">{{ titleCase(zone.type) }}</UBadge>
        <span class="min-w-0 flex-1 truncate">{{ zone.label }}</span>
        <span class="text-xs tabular-nums text-muted">{{ zone.cells.length }} cells</span>
      </li>
    </ul>

    <ul v-else class="space-y-1.5">
      <li v-for="item in pinnable" :key="item.id" class="flex items-center gap-1">
        <button type="button" :class="rowClass(selectedMarker?.id === item.id)" :aria-pressed="selectedMarker?.id === item.id" @click="emit('select-marker', { kind: item.kind, id: item.id })">
          <span class="min-w-0 flex-1">
            <span class="block truncate">{{ item.title }}</span>
            <span class="block truncate text-xs text-muted">{{ item.detail }}</span>
          </span>
          <UBadge color="neutral" variant="subtle" size="sm">{{ titleCase(item.badge) }}</UBadge>
        </button>
        <UTooltip v-if="canWrite" :text="item.isLocked ? 'Pinned: kept when regenerating' : 'Pin to keep when regenerating'">
          <UButton
            size="sm" :color="item.isLocked ? 'primary' : 'neutral'" variant="ghost" :icon="item.isLocked ? 'i-lucide-pin' : 'i-lucide-pin-off'"
            :aria-label="`Pin ${item.title}`" :aria-pressed="item.isLocked" :disabled="busy"
            @click="emit('patch', [{ type: 'TOGGLE_LOCK', entityType: item.entityType, entityId: item.id }])"
          />
        </UTooltip>
      </li>
    </ul>

    <p
      v-if="(section === 'rooms' && !floorMap.rooms.length) || (section === 'corridors' && !floorMap.corridors.length)
        || (section === 'doors' && !floorMap.doors.length) || (section === 'zones' && !floorMap.zones.length)
        || (['traps', 'encounters', 'treasure'].includes(section) && !pinnable.length)"
      class="py-4 text-center text-sm text-muted"
    >
      None on this floor.
    </p>
  </div>
</template>
