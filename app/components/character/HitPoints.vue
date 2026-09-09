<script setup lang="ts">
const props = defineProps<{ name: string; current?: number; max?: number }>()
const current = computed(() => typeof props.current === 'number' && Number.isFinite(props.current) && props.current >= 0 ? props.current : undefined)
const maximum = computed(() => typeof props.max === 'number' && Number.isFinite(props.max) && props.max > 0 ? props.max : undefined)
const proportion = computed(() => current.value !== undefined && maximum.value !== undefined ? Math.min(current.value, maximum.value) : undefined)
const valueLabel = () => `${current.value} of ${maximum.value} hit points`
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-end justify-between gap-2">
      <p class="font-display text-[10px] uppercase tracking-[0.2em] text-muted">Hit Points</p>
      <p class="font-display text-sm text-highlighted">{{ current ?? '—' }}<template v-if="maximum !== undefined"> / {{ maximum }}</template></p>
    </div>
    <UProgress v-if="proportion !== undefined" :model-value="proportion" :max="maximum" color="success" size="sm" :aria-label="`Hit points for ${name}`" :get-value-text="valueLabel" />
  </div>
</template>
