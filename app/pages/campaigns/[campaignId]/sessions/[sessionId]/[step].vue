<script setup lang="ts">
const {
  route,
  campaignId,
  sessionId,
  form,
  canWriteContent,
  canUploadRecording,
  canRunSummary,
  isSaving,
  saveError,
  checklistItems,
  selectedFile,
  selectedKind,
  isUploading,
  uploadError,
  playbackError,
  playbackLoading,
  playbackUrls,
  recordings,
  transcriptDoc,
  transcriptError,
  transcriptImportError,
  transcriptImporting,
  transcriptFile,
  showFullTranscript,
  transcriptPreview,
  fullTranscript,
  selectedSubtitleRecordingId,
  videoOptions,
  subtitleAttachLoading,
  subtitleAttachError,
  selectedSummaryJobId,
  summaryJobOptions,
  summarySending,
  hasTranscript,
  summaryStatusColor,
  summaryStatusLabel,
  summaryJob,
  summaryPendingText,
  summaryHighlights,
  summarySessionTags,
  summaryNotableDialogue,
  summaryConcreteFacts,
  summarySendError,
  summaryActionError,
  summaryForm,
  summarySaving,
  summaryDoc,
  summaryFile,
  summaryImporting,
  summaryError,
  summaryImportError,
  selectedSuggestionJobId,
  suggestionJobOptions,
  suggestionSending,
  hasSummary,
  suggestionStatusColor,
  suggestionStatusLabel,
  suggestionJob,
  suggestionGroups,
  sessionSuggestion,
  suggestionSendError,
  suggestionActionError,
  recapFile,
  recapUploading,
  recapPlaybackLoading,
  recapDeleting,
  recapPlaybackUrl,
  recapError,
  recapDeleteError,
  hasRecap,
  uploadRecording,
  loadPlayback,
  openPlayer,
  saveTranscript,
  importTranscript,
  attachTranscriptToVideo,
  refreshSummaryJob,
  sendSummaryToN8n,
  applyPendingSummary,
  refreshSuggestionJobs,
  generateSuggestions,
  applySuggestion,
  discardSuggestion,
  saveSummary,
  importSummary,
  uploadRecap,
  loadRecapPlayback,
  deleteRecap,
  saveSession,
} = await useSessionWorkspaceViewModel()

const currentStep = computed(() =>
  typeof route.params.step === 'string' ? route.params.step : ''
)

const returnToPath = computed(
  () => `/campaigns/${campaignId}/sessions/${sessionId}/${currentStep.value}`
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
        <UForm :state="form" class="space-y-4" @submit.prevent="saveSession">
          <UFormField label="Title" name="title">
            <UInput v-model="form.title" :disabled="!canWriteContent" placeholder="This Is Why Taverns Have Rules" />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Session number" name="sessionNumber">
              <UInput v-model="form.sessionNumber" :disabled="!canWriteContent" type="number" />
            </UFormField>
            <UFormField label="Played at" name="playedAt">
              <UInput v-model="form.playedAt" :disabled="!canWriteContent" type="date" />
            </UFormField>
          </div>

          <UFormField label="Guest dungeon master" name="guestDungeonMasterName">
            <UInput v-model="form.guestDungeonMasterName" :disabled="!canWriteContent" placeholder="Optional guest DM" />
          </UFormField>

          <UFormField label="Notes" name="notes">
            <UTextarea v-model="form.notes" :disabled="!canWriteContent" :rows="6" />
          </UFormField>

          <p v-if="saveError" class="text-sm text-error">{{ saveError }}</p>

          <div class="flex justify-end">
            <UButton type="submit" :loading="isSaving" :disabled="!canWriteContent">Save session</UButton>
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
        @update:selected-file="selectedFile = $event"
        @update:selected-kind="selectedKind = $event"
        @upload-recording="canUploadRecording && uploadRecording()"
        @play-recording="loadPlayback"
        @open-player="openPlayer"
      />
    </div>

    <div v-else-if="currentStep === 'transcription'" class="space-y-4">
      <SessionTranscriptPanel
        :campaign-id="campaignId"
        :return-to-path="returnToPath"
        :recordings="recordings"
        :transcript-doc="transcriptDoc?.id ? { id: transcriptDoc.id } : null"
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
        @update:transcript-file="transcriptFile = $event"
        @update:show-full-transcript="showFullTranscript = $event"
        @update:selected-subtitle-recording-id="selectedSubtitleRecordingId = $event"
        @create-transcript="canWriteContent && saveTranscript()"
        @import-transcript="canWriteContent && importTranscript()"
        @attach-subtitles="canWriteContent && attachTranscriptToVideo()"
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
        :summary-tracking-id="summaryJob?.trackingId"
        :summary-pending-text="summaryPendingText"
        :summary-highlights="summaryHighlights"
        :summary-session-tags="summarySessionTags"
        :summary-notable-dialogue="summaryNotableDialogue"
        :summary-concrete-facts="summaryConcreteFacts"
        :summary-send-error="summarySendError"
        :summary-action-error="summaryActionError"
        :summary-content="summaryForm.content"
        :summary-saving="summarySaving"
        :summary-doc-id="summaryDoc?.id"
        :summary-file="summaryFile"
        :summary-importing="summaryImporting"
        :summary-error="summaryError"
        :summary-import-error="summaryImportError"
        @update:selected-summary-job-id="selectedSummaryJobId = $event"
        @refresh-jobs="refreshSummaryJob"
        @send-to-n8n="canRunSummary && sendSummaryToN8n()"
        @apply-pending-summary="canRunSummary && applyPendingSummary()"
        @update:summary-content="summaryForm.content = $event"
        @save-summary="canWriteContent && saveSummary()"
        @update:summary-file="summaryFile = $event"
        @import-summary="canWriteContent && importSummary()"
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
        :suggestion-tracking-id="suggestionJob?.trackingId"
        :suggestion-groups="suggestionGroups"
        :session-suggestion="sessionSuggestion"
        :suggestion-send-error="suggestionSendError"
        :suggestion-action-error="suggestionActionError"
        @update:selected-suggestion-job-id="selectedSuggestionJobId = $event"
        @refresh-jobs="refreshSuggestionJobs"
        @generate-suggestions="canRunSummary && generateSuggestions()"
        @apply-suggestion="canRunSummary && applySuggestion($event)"
        @discard-suggestion="canRunSummary && discardSuggestion($event)"
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
        @update:recap-file="recapFile = $event"
        @upload-recap="canUploadRecording && uploadRecap()"
        @play-recap="loadRecapPlayback"
        @delete-recap="canUploadRecording && deleteRecap()"
        @open-player="openPlayer"
      />
    </div>

    <UCard v-else>
      <p class="text-sm text-error">Unknown workflow step.</p>
    </UCard>
  </div>
</template>
