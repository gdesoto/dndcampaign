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
        <h1 class="type-title break-words">{{ props.name }}</h1>
        <div class="mt-2 flex items-center gap-3"><UBadge :color="status === 'ACTIVE' ? 'success' : status === 'PAUSED' ? 'warning' : status === 'ABANDONED' ? 'error' : status === 'PLANNED' ? 'info' : 'neutral'" variant="soft">{{ status.charAt(0) + status.slice(1).toLowerCase() }}</UBadge><span class="font-mono text-sm tabular-nums text-muted">Round {{ round }}</span></div>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton v-if="props.status === 'PLANNED'" icon="i-lucide-play" :disabled="!props.canWrite" @click="emit('start')">Start</UButton>
        <UButton v-if="props.status === 'ACTIVE'" :disabled="!props.canWrite" color="warning" @click="emit('pause')">Pause</UButton>
        <UButton v-if="props.status === 'PAUSED'" :disabled="!props.canWrite" color="primary" @click="emit('resume')">Resume</UButton>
        <UButton :disabled="!props.canWrite" icon="i-lucide-check" color="neutral" variant="outline" @click="emit('complete')">Complete</UButton>
        <SharedActionMenu :name="name" :items="actions" />
      </div>
    </div>
  </UCard>
</template>
