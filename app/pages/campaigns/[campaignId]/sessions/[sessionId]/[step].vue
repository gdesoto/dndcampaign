<script setup lang="ts">
const {
  route,
  campaignId,
  sessionId,
  canWriteContent,
  canUploadRecording,
  canRunSummary,
  selectedFile,
  selectedKind,
  isUploading,
  uploadError,
  playbackError,
  deleteRecordingError,
  deletingRecordingId,
  playbackLoading,
  playbackUrls,
  recordings,
  transcriptDoc,
  transcriptError,
  transcriptDeleteError,
  transcriptDeleting,
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
  recap,
  hasRecap,
  uploadRecording,
  loadPlayback,
  deleteRecording,
  openPlayer,
  saveTranscript,
  importTranscript,
  deleteTranscript,
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
} = await useSessionWorkspaceViewModel()

const currentStep = computed(() =>
  typeof route.params.step === 'string' ? route.params.step : ''
)

const returnToPath = computed(
  () => `/campaigns/${campaignId.value}/sessions/${sessionId.value}/${currentStep.value}`
)
</script>

<template>
  <div class="space-y-4">
    <div v-if="currentStep === 'recordings'" class="space-y-4">
      <SessionRecordingsPanel
        :workflow-mode="true"
        :campaign-id="campaignId"
        :can-manage-recordings="canUploadRecording"
        :recordings="recordings"
        :selected-file="selectedFile"
        :selected-kind="selectedKind"
        :is-uploading="isUploading"
        :upload-error="uploadError"
        :playback-error="playbackError"
        :delete-error="deleteRecordingError"
        :deleting-recording-id="deletingRecordingId"
        :playback-loading="playbackLoading"
        :playback-urls="playbackUrls"
        @update:selected-file="selectedFile = $event"
        @update:selected-kind="selectedKind = $event"
        @upload-recording="canUploadRecording && uploadRecording()"
        @play-recording="loadPlayback"
        @delete-recording="canUploadRecording && deleteRecording($event)"
        @open-player="openPlayer"
      />
    </div>

    <div v-else-if="currentStep === 'transcription'" class="space-y-4">
      <SessionTranscriptPanel
        :campaign-id="campaignId"
        :return-to-path="returnToPath"
        :can-manage-transcript="canWriteContent"
        :recordings="recordings"
        :transcript-doc="transcriptDoc?.id ? { id: transcriptDoc.id } : null"
        :transcript-error="transcriptError"
        :transcript-delete-error="transcriptDeleteError"
        :transcript-deleting="transcriptDeleting"
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
        @delete-transcript="canWriteContent && deleteTranscript()"
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
        :recap="recap"
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
