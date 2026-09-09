<script setup lang="ts">
import type { RecordAction } from '~/types/actions'
const props = defineProps<{
  name: string
  status: string
  round: number
  canWrite: boolean
  resetAction: () => Promise<unknown>
  abandonAction: () => Promise<unknown>
}>()

const emit = defineEmits<{
  start: []
  pause: []
  resume: []
  complete: []
  refresh: []
}>()
const actions = computed<RecordAction[]>(() => [
  { label: 'Refresh', icon: 'i-lucide-refresh-cw', action: () => emit('refresh') },
  ...(props.canWrite ? [
    ...(props.status !== 'PLANNED' ? [{ label: 'Reset to Planned', icon: 'i-lucide-rotate-ccw', destructive: true, action: props.resetAction, confirmation: { message: `Reset ${props.name} to planned? This resets encounter turn progress.`, label: 'Reset to Planned' } }] : []),
    { label: 'Abandon', icon: 'i-lucide-x', destructive: true, action: props.abandonAction, confirmation: { message: `Abandon ${props.name}? This ends the encounter.`, label: 'Abandon' } },
  ] : []),
])
</script>

<template>
  <UCard>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Encounter runtime</p>
        <h1 class="text-2xl font-semibold">{{ props.name }}</h1>
        <p class="text-sm text-muted">Status: {{ props.status }} · Round {{ props.round }}</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton v-if="props.status === 'PLANNED'" :disabled="!props.canWrite" @click="emit('start')">Start</UButton>
        <UButton v-if="props.status === 'ACTIVE'" :disabled="!props.canWrite" color="warning" @click="emit('pause')">Pause</UButton>
        <UButton v-if="props.status === 'PAUSED'" :disabled="!props.canWrite" color="primary" @click="emit('resume')">Resume</UButton>
        <UButton :disabled="!props.canWrite" color="neutral" @click="emit('complete')">Complete</UButton>
        <SharedActionMenu :name="name" :items="actions" />
      </div>
    </div>
  </UCard>
</template>
