<script setup lang="ts">
type WorkflowStep = 'recordings' | 'transcription' | 'summary' | 'suggestions' | 'recap'

const props = defineProps<{
  recordingsCount: number
  transcriptStatus: string
  summaryStatus: string
  suggestionStatus?: string
  recapStatus: string
  mode: 'overview' | 'workflow'
  activeStep: string
}>()

const emit = defineEmits<{
  'jump-step': [step: WorkflowStep]
}>()

const statusCards = computed(() => [
  {
    id: 'recordings' as const,
    label: 'Recordings',
    value: String(props.recordingsCount),
    hint: props.recordingsCount ? 'Media uploaded.' : 'Add media files.',
  },
  {
    id: 'transcription' as const,
    label: 'Transcript',
    value: props.transcriptStatus,
    hint: props.transcriptStatus === 'Available' ? 'Ready to review.' : 'Awaiting transcript.',
  },
  {
    id: 'summary' as const,
    label: 'Summary',
    value: props.summaryStatus,
    hint: props.summaryStatus === 'Available' ? 'Capture key beats.' : 'Generate summary.',
  },
  {
    id: 'suggestions' as const,
    label: 'Suggestions',
    value: props.suggestionStatus || 'Not started',
    hint: props.suggestionStatus === 'Ready for review' ? 'Review changes.' : 'Generate suggestions.',
  },
  {
    id: 'recap' as const,
    label: 'Recap',
    value: props.recapStatus,
    hint: props.recapStatus === 'Attached' ? 'Ready to play.' : 'Upload recap.',
  },
])
</script>

<template>
  <UCard class="sm:hidden">
    <div class="theme-accent mb-4 font-display text-sm tracking-[0.4em] uppercase">
      Status
    </div>
    <div class="space-y-2 text-sm">
      <div
        v-for="card in statusCards"
        :key="card.id"
        class="flex items-center justify-between gap-2 rounded-lg border border-default p-2"
      >
        <span>{{ card.label }}</span>
        <div class="flex items-center gap-2">
          <span class="font-semibold">{{ card.value }}</span>
          <UTooltip text="Open step" :content="{ side: 'left' }">
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-square-arrow-out-up-right"
              aria-label="Open step"
              @click="emit('jump-step', card.id)"
            />
          </UTooltip>
        </div>
      </div>
    </div>
  </UCard>

  <div class="hidden gap-4 sm:grid md:grid-cols-2 xl:grid-cols-5">
    <UCard
      v-for="card in statusCards"
      :key="card.id"
      :class="mode === 'workflow' && activeStep === card.id ? 'ring-2 ring-primary/40' : ''"
      :ui="{ body: 'p-4' }"
    >
      <div class="flex items-start justify-between gap-3">
        <p class="text-xs uppercase tracking-[0.2em] text-dimmed">{{ card.label }}</p>
        <UTooltip text="Open step" :content="{ side: 'left' }">
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-square-arrow-out-up-right"
            aria-label="Open step"
            @click="emit('jump-step', card.id)"
          />
        </UTooltip>
      </div>
      <p class="mt-2 text-lg font-semibold">{{ card.value }}</p>
      <p class="text-xs text-muted">{{ card.hint }}</p>
    </UCard>
  </div>
</template>
