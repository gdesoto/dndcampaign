<script setup lang="ts">
const { campaignId, sessionId, resource, recording, recap, transcript, summary, suggestions, overview, openPlayer } = useSessionWorkspaceContext()
const route = useRoute()
const currentStep = computed(() => typeof route.params.step === 'string' ? route.params.step : '')
const returnToPath = computed(() => `/campaigns/${campaignId.value}/sessions/${sessionId.value}/${currentStep.value}`)
</script>

<template>
  <div class="space-y-4">
    <div v-if="currentStep === 'recordings'" class="space-y-4">
      <SessionRecordingsPanel
        :workflow-mode="true"
        :campaign-id="campaignId"
        :can-manage-recordings="resource.canUploadRecording"
        :recordings="resource.recordings"
        :selected-file="recording.selectedFile"
        :selected-kind="recording.selectedKind"
        :is-uploading="recording.isUploading"
        :upload-error="recording.uploadError"
        :playback-error="recording.playbackError"
        :delete-error="recording.deleteError"
        :deleting-recording-id="recording.deletingRecordingId"
        :playback-loading="recording.playbackLoading"
        :playback-urls="recording.playbackUrls"
        :delete-recording="resource.canUploadRecording ? recording.deleteRecording : undefined"
        @update:selected-file="recording.selectedFile = $event"
        @update:selected-kind="recording.selectedKind = $event"
        @upload-recording="resource.canUploadRecording && recording.uploadRecording()"
        @play-recording="recording.loadPlayback"
        @open-player="openPlayer"
      />
    </div>

    <div v-else-if="currentStep === 'transcription'" class="space-y-4">
      <SessionTranscriptPanel
        :campaign-id="campaignId"
        :return-to-path="returnToPath"
        :can-manage-transcript="resource.canWriteContent"
        :recordings="resource.recordings"
        :transcript-doc="resource.transcriptDoc?.id ? { id: resource.transcriptDoc.id } : null"
        :transcript-error="transcript.transcriptError"
        :transcript-delete-error="transcript.transcriptDeleteError"
        :transcript-deleting="transcript.transcriptDeleting"
        :transcript-import-error="transcript.transcriptImportError"
        :transcript-importing="transcript.transcriptImporting"
        :transcript-file="transcript.transcriptFile"
        :show-full-transcript="transcript.showFullTranscript"
        :transcript-preview="transcript.transcriptPreview"
        :full-transcript="transcript.fullTranscript"
        :selected-subtitle-recording-id="transcript.selectedSubtitleRecordingId"
        :video-options="transcript.videoOptions"
        :subtitle-attach-loading="transcript.subtitleAttachLoading"
        :subtitle-attach-error="transcript.subtitleAttachError"
        :delete-transcript="resource.canWriteContent ? transcript.deleteTranscript : undefined"
        @update:transcript-file="transcript.transcriptFile = $event"
        @update:show-full-transcript="transcript.showFullTranscript = $event"
        @update:selected-subtitle-recording-id="transcript.selectedSubtitleRecordingId = $event"
        @create-transcript="resource.canWriteContent && transcript.saveTranscript()"
        @import-transcript="resource.canWriteContent && transcript.importTranscript()"
        @attach-subtitles="resource.canWriteContent && transcript.attachTranscriptToVideo()"
      />
    </div>

    <div v-else-if="currentStep === 'summary'" class="space-y-4">
      <SessionSummaryPanel
        :dirty="summary.summaryDirty"
        :can-edit="resource.canWriteContent"
        :can-generate="resource.canRunSummary"
        :campaign-id="campaignId"
        :return-to-path="returnToPath"
        :selected-summary-job-id="summary.selectedSummaryJobId"
        :summary-job-options="summary.summaryJobOptions"
        :summary-sending="summary.summarySending"
        :has-transcript="overview.hasTranscript"
        :summary-status-color="summary.summaryStatusColor"
        :summary-status-label="summary.summaryStatusLabel"
        :summary-tracking-id="summary.summaryJob?.trackingId"
        :summary-pending-text="summary.summaryPendingText"
        :summary-highlights="summary.summaryHighlights"
        :summary-session-tags="summary.summarySessionTags"
        :summary-notable-dialogue="summary.summaryNotableDialogue"
        :summary-concrete-facts="summary.summaryConcreteFacts"
        :summary-send-error="summary.summarySendError"
        :summary-action-error="summary.summaryActionError"
        :summary-content="summary.summaryForm.content"
        :summary-saving="summary.summarySaving"
        :summary-doc-id="resource.summaryDoc?.id"
        :summary-file="summary.summaryFile"
        :summary-importing="summary.summaryImporting"
        :summary-error="summary.summaryError"
        :summary-import-error="summary.summaryImportError"
        @update:selected-summary-job-id="summary.selectedSummaryJobId = $event"
        @refresh-jobs="summary.refreshSummaryJob"
        @send-to-n8n="resource.canRunSummary && summary.sendSummaryToN8n()"
        @apply-pending-summary="resource.canRunSummary && summary.applyPendingSummary()"
        @update:summary-content="summary.summaryForm.content = $event"
        @save-summary="resource.canWriteContent && summary.saveSummary()"
        @update:summary-file="summary.summaryFile = $event"
        @import-summary="resource.canWriteContent && summary.importSummary()"
      />
    </div>

    <div v-else-if="currentStep === 'suggestions'" class="space-y-4">
      <SessionSuggestionsPanel
        :can-generate="resource.canRunSummary"
        :selected-suggestion-job-id="suggestions.selectedSuggestionJobId"
        :suggestion-job-options="suggestions.suggestionJobOptions"
        :suggestion-sending="suggestions.suggestionSending"
        :applying="suggestions.suggestionApplying"
        :has-summary="overview.hasSummary"
        :suggestion-status-color="suggestions.suggestionStatusColor"
        :suggestion-status-label="suggestions.suggestionStatusLabel"
        :suggestion-tracking-id="suggestions.suggestionJob?.trackingId"
        :suggestion-groups="suggestions.suggestionGroups"
        :session-suggestion="suggestions.sessionSuggestion"
        :suggestion-send-error="suggestions.suggestionSendError"
        :suggestion-action-error="suggestions.suggestionActionError"
        @update:selected-suggestion-job-id="suggestions.selectedSuggestionJobId = $event"
        @refresh-jobs="suggestions.refreshSuggestionJobs"
        @generate-suggestions="resource.canRunSummary && suggestions.generateSuggestions()"
        @apply-suggestion="resource.canRunSummary && suggestions.applySuggestion($event)"
        @discard-suggestion="resource.canRunSummary && suggestions.discardSuggestion($event)"
      />
    </div>

    <div v-else-if="currentStep === 'recap'" class="space-y-4">
      <SessionRecapPanel
        v-model:selected-kind="recap.selectedRecapKind"
        :can-manage="resource.canUploadRecording"
        :campaign-id="campaignId"
        :workflow-mode="true"
        :recap="recap.recap"
        :recaps="resource.recaps"
        :recap-file="recap.recapFile"
        :recap-uploading="recap.recapUploading"
        :recap-playback-loading="recap.recapPlaybackLoading"
        :recap-deleting="recap.recapDeleting"
        :recap-playback-url="recap.recapPlaybackUrl"
        :recap-error="recap.recapError"
        :recap-delete-error="recap.recapDeleteError"
        :has-recap="Boolean(recap.recap)"
        :delete-recap="resource.canUploadRecording ? recap.deleteRecap : undefined"
        @update:recap-file="recap.recapFile = $event"
        @upload-recap="resource.canUploadRecording && recap.uploadRecap()"
        @play-recap="recap.loadRecapPlayback"
        @open-player="openPlayer"
      />
    </div>

    <UCard v-else>
      <p class="text-sm text-error">Unknown workflow step.</p>
    </UCard>
  </div>
</template>
