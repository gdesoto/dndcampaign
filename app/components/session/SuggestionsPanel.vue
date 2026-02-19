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
        <h2 class="text-lg font-semibold">Suggestion generation</h2>
        <p class="text-sm text-muted">
          Generate and review suggestions from the current session summary.
        </p>
      </div>
    </template>
    <div class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
        <USelect
          v-model="selectedSuggestionJobIdModel"
          :items="suggestionJobOptions"
          placeholder="Select suggestion job"
        />
        <UButton size="sm" variant="outline" @click="emit('refresh-jobs')">
          Refresh jobs
        </UButton>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          :loading="suggestionSending"
          :disabled="!hasSummary"
          @click="emit('generate-suggestions')"
        >
          Generate suggestions
        </UButton>
        <UBadge variant="soft" :color="suggestionStatusColor" size="sm">
          {{ suggestionStatusLabel }}
        </UBadge>
        <span v-if="suggestionTrackingId" class="text-xs text-muted">
          {{ suggestionTrackingId }}
        </span>
      </div>

      <SessionSummarySuggestionList
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
