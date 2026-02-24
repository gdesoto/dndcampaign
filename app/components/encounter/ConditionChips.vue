<script setup lang="ts">
import type { EncounterCondition } from '#shared/types/encounter'

const props = defineProps<{
  conditions: EncounterCondition[]
}>()
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <UBadge v-for="condition in props.conditions" :key="condition.id" variant="soft" color="warning">
      {{ condition.name }}
      <template v-if="typeof condition.remaining === 'number'">({{ condition.remaining }})</template>
    </UBadge>
    <span v-if="!props.conditions.length" class="text-xs text-muted">No conditions tracked.</span>
  </div>
</template>