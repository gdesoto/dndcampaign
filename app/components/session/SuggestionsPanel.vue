<script setup lang="ts">
type SuggestionItem = {
  id: string
  entityType: string
  action: string
  status: string
  payload: Record<string, unknown>
}

type SuggestionGroup = {
  label: string
  items: SuggestionItem[]
}

type SessionSuggestion = SuggestionItem | null

type UiColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

const props = defineProps<{
  applying?: boolean
  canGenerate?: boolean
  selectedSuggestionJobId: string
  suggestionJobOptions: Array<{ label: string; value: string }>
  suggestionSending: boolean
  hasSummary: boolean
  suggestionStatusColor: UiColor
  suggestionStatusLabel: string
  suggestionTrackingId?: string
  suggestionGroups: SuggestionGroup[]
  sessionSuggestion: SessionSuggestion
  suggestionSendError: string
  suggestionActionError: string
}>()

const emit = defineEmits<{
  'update:selectedSuggestionJobId': [value: string]
  'refresh-jobs': []
  'generate-suggestions': []
  'apply-suggestion': [input: { suggestionId: string; payload: Record<string, unknown> }]
  'discard-suggestion': [suggestionId: string]
}>()

const selectedSuggestionJobIdModel = computed({
  get: () => props.selectedSuggestionJobId,
  set: (value: string | number | undefined) => emit('update:selectedSuggestionJobId', String(value || '')),
})

</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h2 class="type-section flex items-center gap-2"><UIcon name="i-lucide-git-merge" class="size-5 text-primary" aria-hidden="true" /> Story suggestions</h2>
        <p class="text-sm text-muted">
          Generate and review suggestions from the current session summary.
        </p>
      </div>
    </template>
    <div class="space-y-4">
      <div class="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
        <UFormField label="Suggestion job" name="selectedSuggestionJobIdModel">
            <USelect v-model="selectedSuggestionJobIdModel" :disabled="applying || suggestionSending" :items="suggestionJobOptions" placeholder="No job selected" class="w-full" />
          </UFormField>
        <UButton size="sm" variant="outline" :disabled="applying || suggestionSending" @click="emit('refresh-jobs')">
          Refresh jobs
        </UButton>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          :loading="suggestionSending"
          :disabled="!hasSummary || canGenerate === false || applying"
          color="primary"
          variant="solid"
          icon="i-lucide-sparkles"
          @click="emit('generate-suggestions')"
        >
          Generate suggestions
        </UButton>
        <UBadge variant="soft" :color="suggestionStatusColor" size="sm">
          {{ suggestionStatusLabel }}
        </UBadge>
        <span v-if="suggestionTrackingId" class="font-mono text-xs text-muted wrap-anywhere">
          {{ suggestionTrackingId }}
        </span>
      </div>

      <p v-if="!hasSummary" class="text-sm text-muted">Save a summary before generating suggestions.</p>
      <p v-if="applying" role="status" class="text-sm text-muted">Saving suggestion changes…</p>
      <SessionSummarySuggestionList
        :readonly="canGenerate === false || applying || suggestionSending"
        :suggestion-groups="suggestionGroups"
        :session-suggestion="sessionSuggestion"
        @apply-suggestion="emit('apply-suggestion', $event)"
        @discard-suggestion="emit('discard-suggestion', $event)"
      />
      <p v-if="suggestionSendError" class="text-sm text-error">{{ suggestionSendError }}</p>
      <p v-if="suggestionActionError" class="text-sm text-error">{{ suggestionActionError }}</p>
    </div>
  </UCard>
</template>
