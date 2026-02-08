<script setup lang="ts">
const props = defineProps<{
  label: string
  value: string | number
  hint?: string
}>()
</script>

<template>
  <UCard :ui="{ body: 'p-4' }">
    <p class="text-xs uppercase tracking-[0.2em] text-dimmed">{{ label }}</p>
    <p class="mt-2 text-lg font-semibold">{{ value }}</p>
    <p v-if="hint" class="text-xs text-muted">{{ hint }}</p>
  </UCard>
</template>
