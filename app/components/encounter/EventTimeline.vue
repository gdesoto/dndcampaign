<script setup lang="ts">
import type { EncounterEvent } from '#shared/types/encounter'

const props = defineProps<{
  events: EncounterEvent[]
}>()
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-base font-semibold">Event timeline</h2>
    </template>

    <div v-if="props.events.length" class="space-y-2 text-sm">
      <div v-for="event in props.events" :key="event.id" class="rounded-md border border-default p-2">
        <div class="flex items-center justify-between gap-2">
          <strong>{{ event.summary }}</strong>
          <span class="text-xs text-muted">{{ new Date(event.createdAt).toLocaleTimeString() }}</span>
        </div>
        <p class="text-xs text-muted">{{ event.eventType }}</p>
      </div>
    </div>
    <p v-else class="text-sm text-muted">No encounter events yet.</p>
  </UCard>
</template>