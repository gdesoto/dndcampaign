<script setup lang="ts">
import { formatSessionDate } from '~/utils/session-date'
const { campaignId, sessionId, resource, recording, recap, transcript, overview, openPlayer } = useSessionWorkspaceContext()
const sessionPath = computed(() => `/campaigns/${campaignId.value}/sessions/${sessionId.value}`)
</script>

<template>
  <div class="space-y-6 theme-reveal">
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
              :to="`${sessionPath}/transcription`"
            />
          </div>
        </template>
        <p class="whitespace-pre-line reading-copy text-default">{{ transcript.transcriptPreview }}</p>
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
              :to="`${sessionPath}/summary`"
            />
          </div>
        </template>
        <p class="whitespace-pre-line text-sm text-muted">{{ overview.summaryPreview }}</p>
      </UCard>
    </div>

    <!-- Read-only on the overview: upload and delete live on the step pages. -->
    <SessionRecordingsPanel
      :workflow-mode="false"
      :to="`${sessionPath}/recordings`"
      :campaign-id="campaignId"
      :recordings="resource.recordings"
      :selected-file="null"
      selected-kind="AUDIO"
      :is-uploading="recording.isUploading"
      upload-error=""
      :playback-error="recording.playbackError"
      :loading-recording-id="recording.loadingRecordingId"
      :playing-recording-id="recording.playingRecordingId"
      @play-recording="recording.loadPlayback"
      @open-player="openPlayer"
    />

    <SessionRecapPanel
      v-model:selected-kind="recap.selectedRecapKind"
      :campaign-id="campaignId"
      :workflow-mode="false"
      :to="`${sessionPath}/recap`"
      :recap="recap.recap"
      :recaps="resource.recaps"
      :recap-file="null"
      :recap-uploading="recap.recapUploading"
      :recap-playback-loading="recap.recapPlaybackLoading"
      :recap-deleting="recap.recapDeleting"
      :recap-playing="recap.recapPlaying"
      :recap-error="recap.recapError"
      recap-delete-error=""
      :has-recap="Boolean(recap.recap)"
      @play-recap="recap.loadRecapPlayback"
      @open-player="openPlayer"
    />
  </div>
</template>

<style scoped>
.session-story {
  background-image: radial-gradient(ellipse at top right, color-mix(in srgb, var(--ui-primary) 12%, transparent), transparent 65%);
}
</style>
