<script setup lang="ts">
import { formatSessionDate } from '~/utils/session-date'
const {
  campaignId,
  canUploadRecording,
  sessionDungeonMasterLabel,
  transcriptPreview,
  summaryPreview,
  recordingsCount,
  transcriptStatus,
  summaryStatus,
  suggestionStatusLabel,
  recapStatus,
  transcriptDoc,
  summaryDoc,
  recordings,
  selectedFile,
  selectedKind,
  isUploading,
  uploadError,
  playbackError,
  deleteRecordingError,
  deletingRecordingId,
  playbackLoading,
  playbackUrls,
  uploadRecording,
  loadPlayback,
  deleteRecording,
  openPlayer,
  recapFile,
  recapUploading,
  recapPlaybackLoading,
  recapDeleting,
  recapPlaybackUrl,
  recapError,
  recapDeleteError,
  recap,
  recaps,
  selectedRecapKind,
  uploadRecap,
  loadRecapPlayback,
  deleteRecap,
  openSessionSection,
  session,
} = await useSessionWorkspaceViewModel()
</script>

<template>
  <div class="space-y-6 theme-reveal">
    <SessionStatusCards
      :recordings-count="recordingsCount"
      :transcript-status="transcriptStatus"
      :summary-status="summaryStatus"
      :suggestion-status="suggestionStatusLabel"
      :recap-status="recapStatus"
      mode="overview"
      active-step="recordings"
      @jump-step="openSessionSection"
    />

    <UCard class="session-story">
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section class="min-w-0">
          <div class="mb-4 flex items-center gap-3 text-primary">
            <UIcon name="i-lucide-feather" class="size-5" aria-hidden="true" />
            <h2 class="type-section text-highlighted">Session notes</h2>
            <span class="h-px flex-1 bg-primary/20" aria-hidden="true" />
          </div>
          <p class="reading-copy whitespace-pre-wrap text-default wrap-break-word">{{ session?.notes || 'No notes added yet. Edit this session to capture the story.' }}</p>
        </section>
        <dl class="space-y-4 border-t border-primary/20 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <div>
            <dt class="type-label text-muted">Session</dt>
            <dd class="type-metric tabular-nums text-highlighted">{{ session?.sessionNumber ?? '—' }}</dd>
          </div>
          <div>
            <dt class="type-label text-muted">Played on</dt>
            <dd class="mt-1 text-sm text-highlighted">{{ formatSessionDate(session?.playedAt) }}</dd>
          </div>
          <div>
            <dt class="type-label text-muted">Dungeon Master</dt>
            <dd class="mt-2 flex items-center gap-2 text-sm text-highlighted">
              <UAvatar :alt="sessionDungeonMasterLabel" size="xs" />
              {{ sessionDungeonMasterLabel }}
            </dd>
          </div>
        </dl>
      </div>
    </UCard>

    <div class="grid gap-4 lg:grid-cols-2">
      <UCard>
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class=" type-section">Transcript</h2>
              <p class="text-sm text-muted">Latest transcript content.</p>
            </div>
            <SessionStepLinkButton
              step="transcription"
              @open="openSessionSection('transcription')"
            />
          </div>
        </template>
        <div class="space-y-3">
          <p class="whitespace-pre-line reading-copy text-default">{{ transcriptPreview }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="transcriptDoc?.id"
              size="sm"
              variant="outline"
              :to="`/campaigns/${campaignId}/documents/${transcriptDoc.id}`"
            >
              Open editor
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class=" type-section">Summary</h2>
              <p class="text-sm text-muted">Current session summary.</p>
            </div>
            <SessionStepLinkButton
              step="summary"
              @open="openSessionSection('summary')"
            />
          </div>
        </template>
        <div class="space-y-3">
          <p class="whitespace-pre-line text-sm text-muted">{{ summaryPreview }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="summaryDoc?.id"
              size="sm"
              variant="outline"
              :to="`/campaigns/${campaignId}/documents/${summaryDoc.id}`"
            >
              Open editor
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <SessionRecordingsPanel
      :workflow-mode="false"
      open-step="recordings"
      :can-manage-recordings="canUploadRecording"
      :campaign-id="campaignId"
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
      :delete-recording="canUploadRecording ? deleteRecording : undefined"
      @update:selected-file="selectedFile = $event"
      @update:selected-kind="selectedKind = $event"
      @upload-recording="canUploadRecording && uploadRecording()"
      @play-recording="loadPlayback"
      @open-player="openPlayer"
      @open-step="openSessionSection"
    />

    <SessionRecapPanel
      v-model:selected-kind="selectedRecapKind"
      :campaign-id="campaignId"
      :workflow-mode="false"
      open-step="recap"
      :recap="recap"
      :recaps="recaps"
      :recap-file="recapFile"
      :recap-uploading="recapUploading"
      :recap-playback-loading="recapPlaybackLoading"
      :recap-deleting="recapDeleting"
      :recap-playback-url="recapPlaybackUrl"
      :recap-error="recapError"
      :recap-delete-error="recapDeleteError"
      :has-recap="Boolean(recap)"
      :delete-recap="canUploadRecording ? deleteRecap : undefined"
      @update:recap-file="recapFile = $event"
      @upload-recap="canUploadRecording && uploadRecap()"
      @play-recap="loadRecapPlayback"
      @open-player="openPlayer"
      @open-step="openSessionSection"
    />
  </div>
</template>

<style scoped>
.session-story {
  background-image: radial-gradient(ellipse at top right, color-mix(in srgb, var(--ui-primary) 12%, transparent), transparent 65%);
}
</style>
