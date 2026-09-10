<script setup lang="ts">
import type { EncounterEvent } from '#shared/types/encounter'

const props = defineProps<{
  events: EncounterEvent[]
}>()
const items = computed(() => props.events.map(event => ({ ...event, title: event.summary })))
</script>

<template>
  <UCard>
    <template #header>
      <h2 class=" type-section">Event timeline</h2>
    </template>

    <div v-if="items.length" class="max-h-96 overflow-y-auto pr-3" tabindex="0" role="region" aria-label="Encounter event history">
      <UTimeline :items="items" size="xs">
        <template #indicator><UIcon name="i-lucide-history" class="size-3" aria-hidden="true" /></template>
        <template #wrapper="{ item }">
          <p class="text-sm text-default">{{ item.summary }}</p>
          <time :datetime="item.createdAt" class="mt-1 block text-xs tabular-nums text-muted">{{ new Date(item.createdAt).toLocaleString() }}</time>
        </template>
      </UTimeline>
    </div>
    <p v-else class="text-sm text-muted">No encounter events yet.</p>
  </UCard>
</template>
