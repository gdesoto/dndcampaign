<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label: string
  value: string | number
  hint?: string
  tone?: 'neutral' | 'positive' | 'warning' | 'attention'
  icon?: string
}>(), {
  hint: '',
  tone: 'neutral',
  icon: '',
})

const valueToneClass = computed(() => {
  if (props.tone === 'positive') return 'text-success'
  if (props.tone === 'warning') return 'text-warning'
  if (props.tone === 'attention') return 'text-secondary'
  return 'text-highlighted'
})

</script>

<template>
  <UCard variant="soft" :ui="{ body: 'p-4 md:p-5' }">
    <div class="flex items-start justify-between gap-2">
      <p class="type-label">{{ label }}</p>
      <UIcon v-if="icon" :name="icon" aria-hidden="true" class="mt-0.5 size-4 shrink-0 text-muted" />
    </div>
    <div class="mt-3 flex items-end justify-between gap-3">
      <p class="type-metric" :class="valueToneClass">{{ value }}</p>
    </div>
    <p v-if="hint" class="mt-2 text-sm text-muted">{{ hint }}</p>
  </UCard>
</template>
