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
    icon: 'i-lucide-mic',
    ready: false,
    value: String(props.recordingsCount),
    hint: props.recordingsCount ? 'Media uploaded.' : 'Add media files.',
  },
  {
    id: 'transcription' as const,
    label: 'Transcript',
    icon: 'i-lucide-scroll-text',
    ready: props.transcriptStatus === 'Available',
    value: props.transcriptStatus,
    hint: props.transcriptStatus === 'Available' ? 'Ready to review.' : 'Awaiting transcript.',
  },
  {
    id: 'summary' as const,
    label: 'Summary',
    icon: 'i-lucide-book-open',
    ready: props.summaryStatus === 'Available',
    value: props.summaryStatus,
    hint: props.summaryStatus === 'Available' ? 'Capture key beats.' : 'Generate summary.',
  },
  {
    id: 'suggestions' as const,
    label: 'Suggestions',
    icon: 'i-lucide-sparkles',
    ready: props.suggestionStatus === 'Applied',
    value: props.suggestionStatus || 'Not started',
    hint: props.suggestionStatus === 'Ready for review' ? 'Review suggested changes.' : props.suggestionStatus === 'Failed' ? 'Generation failed. Try again.' : props.suggestionStatus === 'Applied' ? 'Changes applied.' : 'Generate suggestions.',
  },
  {
    id: 'recap' as const,
    label: 'Recap',
    icon: 'i-lucide-headphones',
    ready: props.recapStatus === 'Attached',
    value: props.recapStatus,
    hint: props.recapStatus === 'Attached' ? 'Ready to play.' : 'Upload recap.',
  },
].map(card => ({
  ...card,
  color: card.id === 'suggestions' && props.suggestionStatus === 'Ready for review' ? 'warning' as const
    : card.id === 'suggestions' && props.suggestionStatus === 'Failed' ? 'error' as const
      : card.id === 'suggestions' && ['Processing', 'Queued', 'Sent'].includes(props.suggestionStatus || '') ? 'info' as const
        : card.ready ? 'success' as const : 'neutral' as const,
})))
</script>

<template>
  <section aria-label="Session materials" class="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
    <UCard v-for="card in statusCards" :key="card.id" variant="soft" :ui="{ body: 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-4' }">
      <div class="flex min-w-0 items-center gap-2">
        <UIcon :name="card.icon" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <h2 class="type-label text-muted">{{ card.label }}</h2>
      </div>
      <UBadge :color="card.color" variant="subtle" class="max-w-28 whitespace-normal sm:col-span-2 sm:row-start-2 sm:mt-1 sm:max-w-none sm:justify-self-start">{{ card.value }}</UBadge>
      <SessionStepLinkButton :step="card.id" class="sm:col-start-2 sm:row-start-1" @open="emit('jump-step', card.id)" />
      <p class="hidden text-xs text-muted sm:col-span-2 sm:block">{{ card.hint }}</p>
    </UCard>
  </section>
</template>
