<script setup lang="ts">
type SessionForm = {
  sessionNumber: string
  playedAt: string
  notes: string
}

type RecordingItem = {
  id: string
  kind: 'AUDIO' | 'VIDEO'
  filename: string
}

type WorkflowStep = 'details' | 'recordings' | 'transcription' | 'summary' | 'recap'

const props = defineProps<{
  campaignId: string
  form: SessionForm
  sessionDungeonMasterLabel: string
  transcriptPreview: string
  summaryPreview: string
  recordingsCount: number
  transcriptStatus: string
  summaryStatus: string
  recapStatus: string
  transcriptDocId?: string
  summaryDocId?: string
  recordings: RecordingItem[] | null | undefined
  selectedFile: File | null
  selectedKind: 'AUDIO' | 'VIDEO'
  isUploading: boolean
  uploadError: string
  playbackError: string
  playbackLoading: Record<string, boolean>
  playbackUrls: Record<string, string>
  recapFile: File | null
  recapUploading: boolean
  recapPlaybackLoading: boolean
  recapDeleting: boolean
  recapPlaybackUrl: string
  recapError: string
  hasRecap: boolean
}>()

const emit = defineEmits<{
  'open-edit': []
  'jump-step': [step: WorkflowStep]
  'update:selectedFile': [value: File | null]
  'update:selectedKind': [value: 'AUDIO' | 'VIDEO']
  'upload-recording': []
  'play-recording': [recordingId: string]
  'open-player': []
  'update:recapFile': [value: File | null]
  'upload-recap': []
  'play-recap': []
  'delete-recap': []
}>()
</script>

<template>
  <div class="space-y-6">
    <SessionStatusCards
      :recordings-count="recordingsCount"
      :transcript-status="transcriptStatus"
      :summary-status="summaryStatus"
      :recap-status="recapStatus"
      mode="overview"
      active-step="details"
      @jump-step="emit('jump-step', $event)"
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
                @click="emit('jump-step', 'details')"
              />
            </UTooltip>
            <UButton size="sm" variant="outline" @click="emit('open-edit')">
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
                @click="emit('jump-step', 'transcription')"
              />
            </UTooltip>
          </div>
        </template>
        <div class="space-y-3">
          <p class="whitespace-pre-line text-sm text-muted">{{ transcriptPreview }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="transcriptDocId"
              size="sm"
              variant="outline"
              :to="`/campaigns/${campaignId}/documents/${transcriptDocId}`"
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
                @click="emit('jump-step', 'summary')"
              />
            </UTooltip>
          </div>
        </template>
        <div class="space-y-3">
          <p class="whitespace-pre-line text-sm text-muted">{{ summaryPreview }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="summaryDocId"
              size="sm"
              variant="outline"
              :to="`/campaigns/${campaignId}/documents/${summaryDocId}`"
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
      @update:selected-file="emit('update:selectedFile', $event)"
      @update:selected-kind="emit('update:selectedKind', $event)"
      @upload-recording="emit('upload-recording')"
      @play-recording="emit('play-recording', $event)"
      @open-player="emit('open-player')"
      @open-step="emit('jump-step', $event)"
    />

    <SessionRecapPanel
      :workflow-mode="false"
      open-step="recap"
      :recap-file="recapFile"
      :recap-uploading="recapUploading"
      :recap-playback-loading="recapPlaybackLoading"
      :recap-deleting="recapDeleting"
      :recap-playback-url="recapPlaybackUrl"
      :recap-error="recapError"
      :recap-delete-error="''"
      :has-recap="hasRecap"
      @update:recap-file="emit('update:recapFile', $event)"
      @upload-recap="emit('upload-recap')"
      @play-recap="emit('play-recap')"
      @delete-recap="emit('delete-recap')"
      @open-player="emit('open-player')"
      @open-step="emit('jump-step', $event)"
    />
  </div>
</template>
