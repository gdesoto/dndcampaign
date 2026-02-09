<script setup lang="ts">
import type { MapFeatureType } from '#shared/types/api/map'

const props = defineProps<{
  modelValue: MapFeatureType[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: MapFeatureType[]]
}>()

const layerOptions = [
  { label: 'States', value: 'state' },
  { label: 'Markers', value: 'marker' },
  { label: 'Rivers', value: 'river' },
  { label: 'Burgs', value: 'burg' },
  { label: 'Routes', value: 'route' },
  { label: 'Provinces', value: 'province' },
  { label: 'Cells', value: 'cell' },
] as const

const localValue = computed({
  get: () => props.modelValue,
  set: (value: MapFeatureType[]) => emit('update:modelValue', value),
})
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Layers</p>
        <h3 class="mt-1 text-base font-semibold">Viewer toggles</h3>
      </div>
    </template>
    <UCheckboxGroup
      v-model="localValue"
      :items="layerOptions"
      legend="Visible layers"
      variant="card"
      orientation="vertical"
      size="sm"
    />
  </UCard>
</template>
