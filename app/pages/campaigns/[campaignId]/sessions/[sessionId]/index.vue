<script setup lang="ts">
const {
  campaignId,
  canWriteContent,
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
  playbackLoading,
  playbackUrls,
  uploadRecording,
  loadPlayback,
  openPlayer,
  recapFile,
  recapUploading,
  recapPlaybackLoading,
  recapDeleting,
  recapPlaybackUrl,
  recapError,
  recapDeleteError,
  recap,
  hasRecap,
  uploadRecap,
  loadRecapPlayback,
  deleteRecap,
  openSessionSection,
  openEditSession,
  form,
} = await useSessionWorkspaceViewModel()
</script>

<template>
  <div class="space-y-6">
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

    <UCard>
      <template #header>
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold">Session overview</h2>
            <p class="text-sm text-muted">Key details at a glance.</p>
          </div>
          <div class="flex items-center gap-2">
            <UTooltip text="Open step" :content="{ side: 'left' }">
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-square-arrow-out-up-right"
                aria-label="Open step"
                @click="openSessionSection('recordings')"
              />
            </UTooltip>
            <UButton size="sm" variant="outline" :disabled="!canWriteContent" @click="openEditSession">
              Edit session
            </UButton>
          </div>
        </div>
      </template>
      <div class="grid gap-4 sm:grid-cols-3 text-sm">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Session #</p>
          <p class="mt-1 font-semibold">{{ form.sessionNumber || '-' }}</p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Played at</p>
          <p class="mt-1 font-semibold">{{ form.playedAt || 'Unscheduled' }}</p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Dungeon Master</p>
          <p class="mt-1 font-semibold">{{ sessionDungeonMasterLabel }}</p>
        </div>
        <div class="sm:col-span-3">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Notes</p>
          <p class="mt-1 text-sm text-muted">
            {{ form.notes || 'No notes added yet.' }}
          </p>
        </div>
      </div>
    </UCard>

    <div class="grid gap-4 lg:grid-cols-2">
      <UCard>
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold">Transcript</h2>
              <p class="text-sm text-muted">Latest transcript content.</p>
            </div>
            <UTooltip text="Open step" :content="{ side: 'left' }">
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-square-arrow-out-up-right"
                aria-label="Open step"
                @click="openSessionSection('transcription')"
              />
            </UTooltip>
          </div>
        </template>
        <div class="space-y-3">
          <p class="whitespace-pre-line text-sm text-muted">{{ transcriptPreview }}</p>
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
              <h2 class="text-lg font-semibold">Summary</h2>
              <p class="text-sm text-muted">Current session summary.</p>
            </div>
            <UTooltip text="Open step" :content="{ side: 'left' }">
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-square-arrow-out-up-right"
                aria-label="Open step"
                @click="openSessionSection('summary')"
              />
            </UTooltip>
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
      @open-step="openSessionSection"
    />

    <SessionRecapPanel
      :workflow-mode="false"
      open-step="recap"
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
      @open-step="openSessionSection"
    />
  </div>
</template>
