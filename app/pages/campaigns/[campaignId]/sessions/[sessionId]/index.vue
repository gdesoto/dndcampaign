<script setup lang="ts">
import { formatSessionDate } from '~/utils/session-date'
const { campaignId, resource, recording, recap, transcript, suggestions, overview, navigation, openPlayer } = useSessionWorkspaceContext()
</script>

<template>
  <div class="space-y-6 theme-reveal">
    <SessionStatusCards
      :recordings-count="overview.recordingsCount"
      :transcript-status="overview.transcriptStatus"
      :summary-status="overview.summaryStatus"
      :suggestion-status="suggestions.suggestionStatusLabel"
      :recap-status="overview.recapStatus"
      mode="overview"
      active-step="recordings"
      @jump-step="navigation.openSessionSection"
    />

    <UCard class="session-story">
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section class="min-w-0">
          <div class="mb-4 flex items-center gap-3 text-primary">
            <UIcon name="i-lucide-feather" class="size-5" aria-hidden="true" />
            <h2 class="type-section text-highlighted">Session notes</h2>
            <span class="h-px flex-1 bg-primary/20" aria-hidden="true" />
          </div>
          <p class="reading-copy whitespace-pre-wrap text-default wrap-break-word">{{ resource.session?.notes || 'No notes added yet. Edit this session to capture the story.' }}</p>
        </section>
        <dl class="space-y-4 border-t border-primary/20 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <div>
            <dt class="type-label text-muted">Session</dt>
            <dd class="type-metric tabular-nums text-highlighted">{{ resource.session?.sessionNumber ?? '—' }}</dd>
          </div>
          <div>
            <dt class="type-label text-muted">Played on</dt>
            <dd class="mt-1 text-sm text-highlighted">{{ formatSessionDate(resource.session?.playedAt) }}</dd>
          </div>
          <div>
            <dt class="type-label text-muted">Dungeon Master</dt>
            <dd class="mt-2 flex items-center gap-2 text-sm text-highlighted">
              <UAvatar :alt="overview.sessionDungeonMasterLabel" size="xs" />
              {{ overview.sessionDungeonMasterLabel }}
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
              @open="navigation.openSessionSection('transcription')"
            />
          </div>
        </template>
        <div class="space-y-3">
          <p class="whitespace-pre-line reading-copy text-default">{{ transcript.transcriptPreview }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="resource.transcriptDoc?.id"
              size="sm"
              variant="outline"
              :to="`/campaigns/${campaignId}/documents/${resource.transcriptDoc.id}`"
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
              @open="navigation.openSessionSection('summary')"
            />
          </div>
        </template>
        <div class="space-y-3">
          <p class="whitespace-pre-line text-sm text-muted">{{ overview.summaryPreview }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="resource.summaryDoc?.id"
              size="sm"
              variant="outline"
              :to="`/campaigns/${campaignId}/documents/${resource.summaryDoc.id}`"
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
      :can-manage-recordings="resource.canUploadRecording"
      :campaign-id="campaignId"
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
      @open-step="navigation.openSessionSection"
    />

    <SessionRecapPanel
      v-model:selected-kind="recap.selectedRecapKind"
      :campaign-id="campaignId"
      :workflow-mode="false"
      open-step="recap"
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
      @open-step="navigation.openSessionSection"
    />
  </div>
</template>

<style scoped>
.session-story {
  background-image: radial-gradient(ellipse at top right, color-mix(in srgb, var(--ui-primary) 12%, transparent), transparent 65%);
}
</style>
