<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label: string
  value: string | number
  hint?: string
  tone?: 'neutral' | 'positive' | 'warning' | 'attention'
}>(), {
  hint: '',
  tone: 'neutral',
})

const valueToneClass = computed(() => {
  if (props.tone === 'positive') return 'text-success'
  if (props.tone === 'warning') return 'text-warning'
  if (props.tone === 'attention') return 'text-secondary'
  return 'text-highlighted'
})

const markerToneClass = computed(() => {
  if (props.tone === 'positive') return 'bg-success'
  if (props.tone === 'warning') return 'bg-warning'
  if (props.tone === 'attention') return 'bg-secondary'
  return 'bg-muted'
})
</script>

<template>
  <UCard :ui="{ body: 'p-4 md:p-5' }">
    <p class="text-xs uppercase tracking-[0.2em] text-dimmed">{{ label }}</p>
    <div class="mt-3 flex items-end justify-between gap-3">
      <p class="text-3xl leading-none font-semibold" :class="valueToneClass">{{ value }}</p>
      <span class="h-2.5 w-2.5 rounded-full" :class="markerToneClass" />
    </div>
    <p v-if="hint" class="mt-2 text-sm text-muted">{{ hint }}</p>
  </UCard>
</template>
