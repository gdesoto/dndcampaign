<script setup lang="ts">
import type { CampaignEncounterMapRoom, EncounterMapData } from '#shared/types/encounter-map'
import { encounterMapFlows } from '~/utils/encounter-map-options'

const props = defineProps<{
  map: EncounterMapData
  rooms: CampaignEncounterMapRoom[]
  selectedRoomId: string | null
  busy: boolean
}>()
const emit = defineEmits<{
  'select-room': [roomId: string]
}>()

const milestones = computed(() => {
  const flow = props.map.flow
  if (!flow) return []
  return [
    { label: 'Entrance', roomId: flow.entryRoomId, icon: 'i-lucide-log-in' },
    { label: 'Objective', roomId: flow.objectiveRoomId, icon: 'i-lucide-flag' },
    { label: 'Exit', roomId: flow.exitRoomId, icon: 'i-lucide-log-out' },
  ].flatMap(item => {
    const room = props.map.rooms.find(room => room.id === item.roomId)
    if (!room) return []
    const name = props.rooms.find(metadata => metadata.roomNumber === room.roomNumber)?.name
      || room.label || `Room ${room.roomNumber}`
    const floor = (room.floor || 0) + 1
    const floorLabel = props.map.floorLabels?.[floor - 1]
    return [{ ...item, name, floor, floorLabel }]
  })
})
</script>

<template>
  <section v-if="milestones.length === 3" aria-label="Encounter route" class="flex flex-wrap items-center gap-1">
    <UBadge color="neutral" variant="soft" icon="i-lucide-route" class="mr-1">{{ encounterMapFlows.find(item => item.value === map.flow?.style)?.label }}</UBadge>
    <div class="contents">
      <template v-for="(milestone, index) in milestones" :key="milestone.label">
        <UButton
          color="neutral"
          :variant="selectedRoomId === milestone.roomId ? 'soft' : 'ghost'"
          :icon="milestone.icon"
          class="min-w-0 max-w-full"
          :disabled="busy"
          :aria-pressed="selectedRoomId === milestone.roomId"
          :aria-label="`Inspect ${milestone.label.toLowerCase()}: ${milestone.name}, ${milestone.floorLabel || `floor ${milestone.floor}`}`"
          @click="emit('select-room', milestone.roomId)"
        >
          <span class="min-w-0 text-left">
            <span class="block">{{ milestone.label }}</span>
            <span class="block whitespace-normal break-words text-xs text-muted">{{ milestone.name }}<span v-if="(map.floorCount || 1) > 1"> · {{ milestone.floorLabel || `Floor ${milestone.floor}` }}</span></span>
          </span>
        </UButton>
        <UIcon v-if="index < milestones.length - 1" name="i-lucide-arrow-right" class="size-4 shrink-0 text-muted" aria-hidden="true" />
      </template>
    </div>
  </section>
</template>
