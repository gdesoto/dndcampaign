<script setup lang="ts">
import type { RecordAction } from '~/types/actions'
type RecordingItem = {
  id: string
  kind: 'AUDIO' | 'VIDEO'
  filename: string
  mimeType: string
  byteSize: number
  createdAt: string
  vttArtifactId?: string | null
}

type WorkflowStep = 'recordings' | 'transcription' | 'summary' | 'recap'

const props = defineProps<{
  deleteRecording?: (recordingId: string) => Promise<unknown>
  workflowMode: boolean
  openStep?: WorkflowStep
  canManageRecordings?: boolean
  campaignId: string
  recordings: RecordingItem[] | null | undefined
  selectedFile: File | null
  selectedKind: 'AUDIO' | 'VIDEO'
  isUploading: boolean
  uploadError: string
  playbackError: string
  deleteError?: string
  deletingRecordingId?: string
  playbackLoading: Record<string, boolean>
  playbackUrls: Record<string, string>
}>()

const emit = defineEmits<{
  'update:selectedFile': [value: File | null]
  'update:selectedKind': [value: 'AUDIO' | 'VIDEO']
  'upload-recording': []
  'play-recording': [recordingId: string]
  'open-player': []
  'open-step': [step: WorkflowStep]
}>()

const selectedFileModel = computed({
  get: () => props.selectedFile,
  set: (value: File | null | undefined) => emit('update:selectedFile', value ?? null),
})

const selectedKindModel = computed({
  get: () => props.selectedKind,
  set: (value: 'AUDIO' | 'VIDEO') => emit('update:selectedKind', value),
})
const { formatBytes } = useFormatBytes()
const recordingActions = (recording: RecordingItem): RecordAction[] => [
  { label: 'Open', icon: 'i-lucide-arrow-up-right', to: `/campaigns/${props.campaignId}/recordings/${recording.id}` },
  ...(props.workflowMode ? [{ label: 'Transcribe', icon: 'i-lucide-file-text', to: `/campaigns/${props.campaignId}/recordings/${recording.id}?transcribe=1` }] : []),
  ...(props.canManageRecordings && props.deleteRecording ? [{ label: 'Delete', icon: 'i-lucide-trash-2', destructive: true, action: () => props.deleteRecording!(recording.id), confirmation: { message: `Delete recording "${recording.filename}"? This permanently removes its file.` } }] : []),
]

</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class=" type-section">Recordings</h2>
          <p class="text-sm text-muted">
            {{ workflowMode ? 'Upload and review session media.' : 'Playback available media.' }}
          </p>
        </div>
        <SessionStepLinkButton
          v-if="openStep"
          :step="openStep"
          @open="(step) => emit('open-step', step as WorkflowStep)"
        />
      </div>
    </template>

    <div class="space-y-4">
      <div v-if="workflowMode" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="File" name="selectedFile">
            <UFileUpload
              v-model="selectedFileModel"
              accept="audio/*,video/*"
              variant="button"
              label="Select recording"
              :preview="false"
            />
          </UFormField>
          <UFormField label="Kind" name="selectedKind">
            <USelect
              v-model="selectedKindModel"
              :items="[
                { label: 'Audio', value: 'AUDIO' },
                { label: 'Video', value: 'VIDEO' },
              ]"
            />
          </UFormField>
        </div>

        <div class="flex items-center gap-3">
          <UButton :loading="isUploading" @click="emit('upload-recording')">Upload recording</UButton>
          <span v-if="isUploading" class="text-xs text-muted">Uploading...</span>
          <p v-if="uploadError" class="text-sm text-error">{{ uploadError }}</p>
        </div>
      </div>

      <p v-if="workflowMode && playbackError" class="text-sm text-error">{{ playbackError }}</p>
      <p v-if="deleteError" class="text-sm text-error">{{ deleteError }}</p>

      <div v-if="recordings?.length" class="space-y-3">
        <div
          v-for="recording in recordings"
          :key="recording.id"
          class="rounded-lg border border-default bg-elevated/30 p-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <NuxtLink :to="`/campaigns/${campaignId}/recordings/${recording.id}`" class="text-sm font-semibold">{{ recording.filename }}</NuxtLink>
              <p class="text-xs text-muted">
                {{ recording.kind }} - {{ formatBytes(recording.byteSize) }} - {{ new Date(recording.createdAt).toLocaleString() }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                size="xs"
                variant="outline"
                :loading="playbackLoading[recording.id]"
                @click="emit('play-recording', recording.id)"
              >
                Play
              </UButton>
              <SharedActionMenu :name="recording.filename" :items="recordingActions(recording)" :disabled="Boolean(deletingRecordingId)" />
            </div>
          </div>

          <div
            v-if="playbackUrls[recording.id]"
            class="mt-3 flex items-center justify-between gap-3 text-xs text-muted"
          >
            <span>Playing in the global player.</span>
            <UButton size="xs" variant="ghost" @click="emit('open-player')">
              Open player
            </UButton>
          </div>
        </div>
      </div>

      <p v-else class="text-sm text-muted">No recordings yet.</p>
    </div>
  </UCard>
</template>
