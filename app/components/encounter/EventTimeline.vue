<script setup lang="ts">
import type { EncounterEvent, EncounterEventType } from '#shared/types/encounter'

const props = defineProps<{ events: EncounterEvent[] }>()
const descending = ref(true)
const selectedTypes = ref<EncounterEventType[]>([])
const eventTypes = {
  ENCOUNTER: { label: 'Encounter', icon: 'i-lucide-swords', color: 'neutral' },
  TURN: { label: 'Turn', icon: 'i-lucide-circle-play', color: 'neutral' },
  HP: { label: 'Hit points', icon: 'i-lucide-heart-pulse', color: 'neutral' },
  CONDITION: { label: 'Condition', icon: 'i-lucide-sparkles', color: 'neutral' },
  NOTE: { label: 'Note', icon: 'i-lucide-notebook-pen', color: 'info' },
  SYSTEM: { label: 'System', icon: 'i-lucide-settings-2', color: 'neutral' },
} as const
const filterItems = computed(() => Object.entries(eventTypes).map(([value, presentation]) => ({
  label: presentation.label,
  icon: presentation.icon,
  type: 'checkbox' as const,
  checked: selectedTypes.value.includes(value as EncounterEventType),
  onUpdateChecked: (checked: boolean) => {
    selectedTypes.value = checked
      ? [...selectedTypes.value, value as EncounterEventType]
      : selectedTypes.value.filter(type => type !== value)
  },
  onSelect: (event: Event) => event.preventDefault(),
})))
const items = computed(() => props.events
  .filter(event => !selectedTypes.value.length || selectedTypes.value.includes(event.eventType))
  .toSorted((a, b) => (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * (descending.value ? -1 : 1))
  .map(event => {
    const presentation = eventTypes[event.eventType]
    const hpAction = event.eventType === 'HP' ? event.payload?.action : undefined
    return {
      ...event,
      title: event.summary,
      ...presentation,
      ...(hpAction === 'hp.damage' ? { label: 'Damage', icon: 'i-lucide-heart-crack', color: 'error' as const } : {}),
      ...(hpAction === 'hp.heal' ? { label: 'Healing', icon: 'i-lucide-heart-plus', color: 'success' as const } : {}),
    }
  }))
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="type-section">Event timeline <span class="text-muted">{{ items.length }}</span></h2>
        <div class="flex flex-wrap items-center gap-2">
          <UDropdownMenu :items="filterItems" :content="{ align: 'end' }">
            <UTooltip text="Filter event types">
              <UButton icon="i-lucide-list-filter" size="sm" square :color="selectedTypes.length ? 'primary' : 'neutral'" :variant="selectedTypes.length ? 'soft' : 'ghost'" aria-label="Filter event types" />
            </UTooltip>
          </UDropdownMenu>
          <UTooltip :text="descending ? 'Newest first — show oldest first' : 'Oldest first — show newest first'">
            <UButton size="sm" square color="neutral" variant="ghost" :icon="descending ? 'i-lucide-arrow-down-wide-narrow' : 'i-lucide-arrow-up-wide-narrow'" :aria-label="descending ? 'Show oldest first' : 'Show newest first'" @click="descending = !descending" />
          </UTooltip>
          <slot name="actions" />
        </div>
      </div>
    </template>
    <div v-if="selectedTypes.length" class="mb-4 flex flex-wrap items-center gap-2">
      <UBadge v-for="type in selectedTypes" :key="type" :icon="eventTypes[type].icon" color="neutral" variant="soft">{{ eventTypes[type].label }}</UBadge>
      <UButton size="xs" variant="link" @click="selectedTypes = []">Clear filters</UButton>
    </div>
    <div v-if="items.length" role="region" aria-label="Encounter event history">
      <UTimeline
        :items="items"
        size="sm"
        :ui="{ wrapper: 'min-w-0 pb-4 group-last:pb-0', title: 'font-normal whitespace-pre-wrap break-words', date: 'mb-1' }"
      >
        <template #date="{ item }">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <UBadge :color="item.color" variant="soft" size="sm">{{ item.label }}</UBadge>
            <time :datetime="item.createdAt" class="text-xs tabular-nums text-muted">{{ new Date(item.createdAt).toLocaleString() }}</time>
          </div>
        </template>
      </UTimeline>
    </div>
    <p v-else class="text-sm text-muted">{{ events.length ? 'No events match these filters.' : 'No encounter events yet.' }}</p>
  </UCard>
</template>
