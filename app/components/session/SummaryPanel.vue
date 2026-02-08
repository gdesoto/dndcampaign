<script setup lang="ts">
type SummarySuggestion = {
  id: string
  entityType: string
  action: string
  status: string
  payload: Record<string, unknown>
}

type SummarySuggestionGroup = {
  label: string
  items: SummarySuggestion[]
}

type SessionSuggestion = SummarySuggestion | null

const props = defineProps<{
  campaignId: string
  returnToPath?: string
  selectedSummaryJobId: string
  summaryJobOptions: Array<{ label: string; value: string }>
  summarySending: boolean
  hasTranscript: boolean
  summaryStatusColor: string
  summaryStatusLabel: string
  summaryTrackingId?: string
  summaryPendingText: string
  summaryHighlights: unknown[]
  summarySessionTags: unknown[]
  summaryNotableDialogue: unknown[]
  summaryConcreteFacts: unknown[]
  summarySuggestionGroups: SummarySuggestionGroup[]
  sessionSuggestion: SessionSuggestion
  summarySendError: string
  summaryActionError: string
  summaryContent: string
  summarySaving: boolean
  summaryDocId?: string
  summaryFile: File | null
  summaryImporting: boolean
  summaryError: string
  summaryImportError: string
}>()

const emit = defineEmits<{
  'update:selectedSummaryJobId': [value: string]
  'refresh-jobs': []
  'send-to-n8n': []
  'apply-pending-summary': []
  'apply-suggestion': [suggestionId: string]
  'discard-suggestion': [suggestionId: string]
  'update:summaryContent': [value: string]
  'save-summary': []
  'update:summaryFile': [value: File | null]
  'import-summary': []
}>()

const selectedSummaryJobIdModel = computed({
  get: () => props.selectedSummaryJobId,
  set: (value: string | number | undefined) => emit('update:selectedSummaryJobId', String(value || '')),
})

const summaryContentModel = computed({
  get: () => props.summaryContent,
  set: (value: string) => emit('update:summaryContent', value),
})

const summaryFileModel = computed({
  get: () => props.summaryFile,
  set: (value: File | null | undefined) => emit('update:summaryFile', value ?? null),
})

const suggestionTitle = (suggestion: SummarySuggestion) => {
  if (typeof suggestion.payload.title === 'string') return suggestion.payload.title
  if (typeof suggestion.payload.name === 'string') return suggestion.payload.name
  if (typeof suggestion.payload.summary === 'string') return suggestion.payload.summary
  return 'Suggestion'
}
</script>

<template>
  <div class="space-y-4">
    <UCard>
      <template #header>
        <div>
          <h2 class="text-lg font-semibold">n8n summarization</h2>
          <p class="text-sm text-muted">
            Send the transcript to n8n and review suggestions.
          </p>
        </div>
      </template>
      <div class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
          <USelect
            v-model="selectedSummaryJobIdModel"
            :items="summaryJobOptions"
            placeholder="Select summary job"
          />
          <UButton size="sm" variant="outline" @click="emit('refresh-jobs')">
            Refresh jobs
          </UButton>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            :loading="summarySending"
            :disabled="!hasTranscript"
            @click="emit('send-to-n8n')"
          >
            Send transcript to n8n
          </UButton>
          <UBadge variant="soft" :color="summaryStatusColor" size="sm">
            {{ summaryStatusLabel }}
          </UBadge>
          <span v-if="summaryTrackingId" class="text-xs text-muted">
            {{ summaryTrackingId }}
          </span>
        </div>
        <div v-if="summaryPendingText" class="space-y-2">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Pending summary</p>
          <p class="whitespace-pre-line text-sm text-muted">
            {{ summaryPendingText }}
          </p>
          <UButton size="sm" variant="outline" @click="emit('apply-pending-summary')">
            Apply summary
          </UButton>
        </div>
        <div v-if="summaryHighlights.length" class="space-y-2">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Key moments</p>
          <ul class="list-disc space-y-1 pl-5 text-sm text-muted">
            <li v-for="highlight in summaryHighlights" :key="String(highlight)">{{ highlight }}</li>
          </ul>
        </div>
        <div v-if="summarySessionTags.length" class="space-y-2">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Session tags</p>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="tag in summarySessionTags"
              :key="String(tag)"
              variant="soft"
              color="secondary"
              size="sm"
            >
              {{ tag }}
            </UBadge>
          </div>
        </div>
        <div v-if="summaryNotableDialogue.length" class="space-y-2">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Notable dialogue</p>
          <ul class="list-disc space-y-1 pl-5 text-sm text-muted">
            <li v-for="line in summaryNotableDialogue" :key="String(line)">{{ line }}</li>
          </ul>
        </div>
        <div v-if="summaryConcreteFacts.length" class="space-y-2">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Concrete facts</p>
          <ul class="list-disc space-y-1 pl-5 text-sm text-muted">
            <li v-for="fact in summaryConcreteFacts" :key="String(fact)">{{ fact }}</li>
          </ul>
        </div>
        <div v-if="summarySuggestionGroups.length" class="space-y-3">
          <div
            v-if="sessionSuggestion"
            class="rounded-lg border border-default bg-elevated/20 p-4"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-semibold">Session suggestion</p>
              <UBadge variant="soft" color="primary" size="sm">
                {{ sessionSuggestion.action }}
              </UBadge>
            </div>
            <div class="mt-3 space-y-2 text-sm text-muted">
              <div v-if="sessionSuggestion.payload.title">
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Title</p>
                <p class="mt-1 font-semibold text-default">
                  {{ sessionSuggestion.payload.title }}
                </p>
              </div>
              <div v-if="sessionSuggestion.payload.notes">
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Notes</p>
                <p class="mt-1 whitespace-pre-line">
                  {{ sessionSuggestion.payload.notes }}
                </p>
              </div>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <UButton
                size="xs"
                variant="outline"
                :disabled="sessionSuggestion.status !== 'PENDING'"
                @click="emit('apply-suggestion', sessionSuggestion.id)"
              >
                Apply
              </UButton>
              <UButton
                size="xs"
                variant="ghost"
                color="gray"
                :disabled="sessionSuggestion.status !== 'PENDING'"
                @click="emit('discard-suggestion', sessionSuggestion.id)"
              >
                Discard
              </UButton>
            </div>
          </div>
          <div
            v-for="group in summarySuggestionGroups"
            :key="group.label"
            class="rounded-lg border border-default bg-elevated/20 p-4"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-semibold">{{ group.label }}</p>
              <UBadge variant="soft" color="primary" size="sm">
                {{ group.items.length }}
              </UBadge>
            </div>
            <div class="mt-3 space-y-3">
              <div
                v-for="suggestion in group.items"
                :key="suggestion.id"
                class="rounded-md border border-default bg-background/60 p-3"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold">{{ suggestionTitle(suggestion) }}</p>
                    <p class="text-xs text-muted">
                      {{ suggestion.action }} · {{ suggestion.status }}
                    </p>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <UButton
                      size="xs"
                      variant="outline"
                      :disabled="suggestion.status !== 'PENDING'"
                      @click="emit('apply-suggestion', suggestion.id)"
                    >
                      Apply
                    </UButton>
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="gray"
                      :disabled="suggestion.status !== 'PENDING'"
                      @click="emit('discard-suggestion', suggestion.id)"
                    >
                      Discard
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p v-if="summarySendError" class="text-sm text-error">{{ summarySendError }}</p>
        <p v-if="summaryActionError" class="text-sm text-error">{{ summaryActionError }}</p>
      </div>
    </UCard>
    <UCard>
      <template #header>
        <div>
          <h2 class="text-lg font-semibold">Summary</h2>
          <p class="text-sm text-muted">
            Write a recap or import one.
          </p>
        </div>
      </template>
      <div class="space-y-4">
        <UTextarea v-model="summaryContentModel" :rows="5" />
        <div class="flex flex-wrap items-center gap-3">
          <UButton :loading="summarySaving" @click="emit('save-summary')">Save summary</UButton>
          <UButton
            v-if="summaryDocId"
            variant="outline"
            :to="props.returnToPath
              ? {
                  path: `/campaigns/${campaignId}/documents/${summaryDocId}`,
                  query: { returnTo: props.returnToPath },
                }
              : `/campaigns/${campaignId}/documents/${summaryDocId}`"
          >
            Open editor
          </UButton>
        </div>
        <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
          <UFileUpload
            v-model="summaryFileModel"
            accept=".txt,.md,.markdown"
            variant="button"
            label="Select summary file"
            :preview="false"
          />
          <UButton :loading="summaryImporting" variant="outline" @click="emit('import-summary')">
            Import file
          </UButton>
        </div>
        <p v-if="summaryError" class="text-sm text-error">{{ summaryError }}</p>
        <p v-if="summaryImportError" class="text-sm text-error">{{ summaryImportError }}</p>
      </div>
    </UCard>
  </div>
</template>
