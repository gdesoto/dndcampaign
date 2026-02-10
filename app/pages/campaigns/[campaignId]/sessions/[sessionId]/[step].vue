<script setup lang="ts">
const route = useRoute()

const props = defineProps<{
  campaignId: string
  form: {
    title: string
    sessionNumber: string
    playedAt: string
    guestDungeonMasterName: string
    notes: string
  }
  isSaving: boolean
  saveError: string
  checklistItems: Array<{ id: string; label: string; done: boolean }>
  selectedFile: File | null
  selectedKind: 'AUDIO' | 'VIDEO'
  isUploading: boolean
  uploadError: string
  playbackError: string
  playbackLoading: Record<string, boolean>
  playbackUrls: Record<string, string>
  recordings: Array<{ id: string; kind: 'AUDIO' | 'VIDEO'; filename: string }> | null | undefined
  transcriptDocId?: string
  transcriptError: string
  transcriptImportError: string
  transcriptImporting: boolean
  transcriptFile: File | null
  showFullTranscript: boolean
  transcriptPreview: string
  fullTranscript: string
  selectedSubtitleRecordingId: string
  videoOptions: Array<{ label: string; value: string }>
  subtitleAttachLoading: boolean
  subtitleAttachError: string
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
  hasSummary: boolean
  selectedSuggestionJobId: string
  suggestionJobOptions: Array<{ label: string; value: string }>
  suggestionSending: boolean
  suggestionStatusColor: string
  suggestionStatusLabel: string
  suggestionTrackingId?: string
  suggestionGroups: Array<{
    label: string
    items: Array<{
      id: string
      entityType: string
      action: string
      status: string
      payload: Record<string, unknown>
    }>
  }>
  sessionSuggestion: {
    id: string
    entityType: string
    action: string
    status: string
    payload: Record<string, unknown>
  } | null
  summarySendError: string
  summaryActionError: string
  suggestionSendError: string
  suggestionActionError: string
  summaryContent: string
  summarySaving: boolean
  summaryDocId?: string
  summaryFile: File | null
  summaryImporting: boolean
  summaryError: string
  summaryImportError: string
  recapFile: File | null
  recapUploading: boolean
  recapPlaybackLoading: boolean
  recapDeleting: boolean
  recapPlaybackUrl: string
  recapError: string
  recapDeleteError: string
  hasRecap: boolean
}>()

const emit = defineEmits<{
  'open-edit': []
  'update:selectedFile': [value: File | null]
  'update:selectedKind': [value: 'AUDIO' | 'VIDEO']
  'upload-recording': []
  'play-recording': [recordingId: string]
  'open-player': []
  'update:transcriptFile': [value: File | null]
  'update:showFullTranscript': [value: boolean]
  'update:selectedSubtitleRecordingId': [value: string]
  'create-transcript': []
  'import-transcript': []
  'attach-subtitles': []
  'update:selectedSummaryJobId': [value: string]
  'refresh-jobs': []
  'send-to-n8n': []
  'apply-pending-summary': []
  'update:selectedSuggestionJobId': [value: string]
  'refresh-suggestion-jobs': []
  'generate-suggestions': []
  'apply-suggestion': [input: { suggestionId: string; payload: Record<string, unknown> }]
  'discard-suggestion': [suggestionId: string]
  'update:summaryContent': [value: string]
  'save-summary': []
  'update:summaryFile': [value: File | null]
  'import-summary': []
  'update:recapFile': [value: File | null]
  'upload-recap': []
  'play-recap': []
  'delete-recap': []
  'save-session': []
}>()

const currentStep = computed(() =>
  typeof route.params.step === 'string' ? route.params.step : ''
)

const returnToPath = computed(
  () => `/campaigns/${props.campaignId}/sessions/${route.params.sessionId}/${currentStep.value}`
)
</script>

<template>
  <div class="space-y-4">
    <div v-if="currentStep === 'details'" class="space-y-4">
      <UCard>
        <template #header>
          <div>
            <div>
              <h2 class="text-lg font-semibold">Session details</h2>
              <p class="text-sm text-muted">Keep the record current.</p>
            </div>
          </div>
        </template>
        <UForm :state="form" class="space-y-4" @submit.prevent="emit('save-session')">
          <UFormField label="Title" name="title">
            <UInput v-model="form.title" placeholder="This Is Why Taverns Have Rules" />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Session number" name="sessionNumber">
              <UInput v-model="form.sessionNumber" type="number" />
            </UFormField>
            <UFormField label="Played at" name="playedAt">
              <UInput v-model="form.playedAt" type="date" />
            </UFormField>
          </div>

          <UFormField label="Guest dungeon master" name="guestDungeonMasterName">
            <UInput v-model="form.guestDungeonMasterName" placeholder="Optional guest DM" />
          </UFormField>

          <UFormField label="Notes" name="notes">
            <UTextarea v-model="form.notes" :rows="6" />
          </UFormField>

          <p v-if="saveError" class="text-sm text-error">{{ saveError }}</p>

          <div class="flex justify-end">
            <UButton type="submit" :loading="isSaving">Save session</UButton>
          </div>
        </UForm>
      </UCard>
      <SessionChecklistCard :items="checklistItems" />
    </div>

    <div v-else-if="currentStep === 'recordings'" class="space-y-4">
      <SessionRecordingsPanel
        :workflow-mode="true"
        :campaign-id="campaignId"
        :recordings="recordings"
        :selected-file="selectedFile"
        :selected-kind="selectedKind"
        :is-uploading="isUploading"
        :upload-error="uploadError"
        :playback-error="playbackError"
        :playback-loading="playbackLoading"
        :playback-urls="playbackUrls"
        @update:selected-file="emit('update:selectedFile', $event)"
        @update:selected-kind="emit('update:selectedKind', $event)"
        @upload-recording="emit('upload-recording')"
        @play-recording="emit('play-recording', $event)"
        @open-player="emit('open-player')"
      />
    </div>

    <div v-else-if="currentStep === 'transcription'" class="space-y-4">
      <SessionTranscriptPanel
        :campaign-id="campaignId"
        :return-to-path="returnToPath"
        :recordings="recordings"
        :transcript-doc="transcriptDocId ? { id: transcriptDocId } : null"
        :transcript-error="transcriptError"
        :transcript-import-error="transcriptImportError"
        :transcript-importing="transcriptImporting"
        :transcript-file="transcriptFile"
        :show-full-transcript="showFullTranscript"
        :transcript-preview="transcriptPreview"
        :full-transcript="fullTranscript"
        :selected-subtitle-recording-id="selectedSubtitleRecordingId"
        :video-options="videoOptions"
        :subtitle-attach-loading="subtitleAttachLoading"
        :subtitle-attach-error="subtitleAttachError"
        @update:transcript-file="emit('update:transcriptFile', $event)"
        @update:show-full-transcript="emit('update:showFullTranscript', $event)"
        @update:selected-subtitle-recording-id="emit('update:selectedSubtitleRecordingId', $event)"
        @create-transcript="emit('create-transcript')"
        @import-transcript="emit('import-transcript')"
        @attach-subtitles="emit('attach-subtitles')"
      />
    </div>

    <div v-else-if="currentStep === 'summary'" class="space-y-4">
      <SessionSummaryPanel
        :campaign-id="campaignId"
        :return-to-path="returnToPath"
        :selected-summary-job-id="selectedSummaryJobId"
        :summary-job-options="summaryJobOptions"
        :summary-sending="summarySending"
        :has-transcript="hasTranscript"
        :summary-status-color="summaryStatusColor"
        :summary-status-label="summaryStatusLabel"
        :summary-tracking-id="summaryTrackingId"
        :summary-pending-text="summaryPendingText"
        :summary-highlights="summaryHighlights"
        :summary-session-tags="summarySessionTags"
        :summary-notable-dialogue="summaryNotableDialogue"
        :summary-concrete-facts="summaryConcreteFacts"
        :summary-send-error="summarySendError"
        :summary-action-error="summaryActionError"
        :summary-content="summaryContent"
        :summary-saving="summarySaving"
        :summary-doc-id="summaryDocId"
        :summary-file="summaryFile"
        :summary-importing="summaryImporting"
        :summary-error="summaryError"
        :summary-import-error="summaryImportError"
        @update:selected-summary-job-id="emit('update:selectedSummaryJobId', $event)"
        @refresh-jobs="emit('refresh-jobs')"
        @send-to-n8n="emit('send-to-n8n')"
        @apply-pending-summary="emit('apply-pending-summary')"
        @update:summary-content="emit('update:summaryContent', $event)"
        @save-summary="emit('save-summary')"
        @update:summary-file="emit('update:summaryFile', $event)"
        @import-summary="emit('import-summary')"
      />
    </div>

    <div v-else-if="currentStep === 'suggestions'" class="space-y-4">
      <SessionSuggestionsPanel
        :selected-suggestion-job-id="selectedSuggestionJobId"
        :suggestion-job-options="suggestionJobOptions"
        :suggestion-sending="suggestionSending"
        :has-summary="hasSummary"
        :suggestion-status-color="suggestionStatusColor"
        :suggestion-status-label="suggestionStatusLabel"
        :suggestion-tracking-id="suggestionTrackingId"
        :suggestion-groups="suggestionGroups"
        :session-suggestion="sessionSuggestion"
        :suggestion-send-error="suggestionSendError"
        :suggestion-action-error="suggestionActionError"
        @update:selected-suggestion-job-id="emit('update:selectedSuggestionJobId', $event)"
        @refresh-jobs="emit('refresh-suggestion-jobs')"
        @generate-suggestions="emit('generate-suggestions')"
        @apply-suggestion="emit('apply-suggestion', $event)"
        @discard-suggestion="emit('discard-suggestion', $event)"
      />
    </div>

    <div v-else-if="currentStep === 'recap'" class="space-y-4">
      <SessionRecapPanel
        :workflow-mode="true"
        :recap-file="recapFile"
        :recap-uploading="recapUploading"
        :recap-playback-loading="recapPlaybackLoading"
        :recap-deleting="recapDeleting"
        :recap-playback-url="recapPlaybackUrl"
        :recap-error="recapError"
        :recap-delete-error="recapDeleteError"
        :has-recap="hasRecap"
        @update:recap-file="emit('update:recapFile', $event)"
        @upload-recap="emit('upload-recap')"
        @play-recap="emit('play-recap')"
        @delete-recap="emit('delete-recap')"
        @open-player="emit('open-player')"
      />
    </div>

    <UCard v-else>
      <p class="text-sm text-error">Unknown workflow step.</p>
    </UCard>
  </div>
</template>
