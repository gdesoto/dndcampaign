<script setup lang="ts">
import type { TimelineItem } from '@nuxt/ui'

const props = defineProps<{
  activeStep: string
  items: TimelineItem[]
}>()

const emit = defineEmits<{
  'update:activeStep': [value: string]
  'step-selected': [value: string]
}>()

const activeStepModel = computed({
  get: () => props.activeStep,
  set: (value: string | number | undefined) => {
    if (value === undefined) return
    emit('update:activeStep', String(value))
  },
})

const handleSelect = (_event: Event, item: TimelineItem) => {
  if (item.value !== undefined) {
    const selectedStep = String(item.value)
    emit('update:activeStep', selectedStep)
    emit('step-selected', selectedStep)
  }
}
</script>

<template>
  <UCard class="h-fit">
    <div class="theme-accent mb-3 font-display text-xs tracking-[0.35em] uppercase">
      Session navigation
    </div>
    <div class="overflow-x-auto pb-1">
      <UTimeline
        v-model="activeStepModel"
        :items="items"
        orientation="horizontal"
        class="min-w-[42rem]"
        @select="handleSelect"
      />
    </div>
  </UCard>
</template>
