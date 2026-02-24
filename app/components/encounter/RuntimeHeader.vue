<script setup lang="ts">
const props = defineProps<{
  name: string
  status: string
  round: number
  canWrite: boolean
}>()

const emit = defineEmits<{
  start: []
  pause: []
  resume: []
  complete: []
  abandon: []
  reset: []
  refresh: []
}>()
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
        <UButton variant="outline" @click="emit('refresh')">Refresh</UButton>
        <UButton v-if="props.status === 'PLANNED'" :disabled="!props.canWrite" @click="emit('start')">Start</UButton>
        <UButton v-if="props.status === 'ACTIVE'" :disabled="!props.canWrite" color="warning" @click="emit('pause')">Pause</UButton>
        <UButton v-if="props.status === 'PAUSED'" :disabled="!props.canWrite" color="primary" @click="emit('resume')">Resume</UButton>
        <UButton v-if="props.status !== 'PLANNED'" :disabled="!props.canWrite" color="secondary" variant="outline" @click="emit('reset')">Reset to Planned</UButton>
        <UButton :disabled="!props.canWrite" color="neutral" @click="emit('complete')">Complete</UButton>
        <UButton :disabled="!props.canWrite" color="error" variant="soft" @click="emit('abandon')">Abandon</UButton>
      </div>
    </div>
  </UCard>
</template>
