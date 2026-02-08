<script setup lang="ts">
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
  workflowMode: boolean
  openStep?: WorkflowStep
  campaignId: string
  recordings: RecordingItem[] | null | undefined
  selectedFile: File | null
  selectedKind: 'AUDIO' | 'VIDEO'
  isUploading: boolean
  uploadError: string
  playbackError: string
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

const formatBytes = (value: number) => {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">Recordings</h2>
          <p class="text-sm text-muted">
            {{ workflowMode ? 'Upload and review session media.' : 'Playback available media.' }}
          </p>
        </div>
        <UTooltip v-if="openStep" text="Open step" :content="{ side: 'left' }">
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-square-arrow-out-up-right"
            aria-label="Open step"
            @click="emit('open-step', openStep)"
          />
        </UTooltip>
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

      <div v-if="recordings?.length" class="space-y-3">
        <div
          v-for="recording in recordings"
          :key="recording.id"
          class="rounded-lg border border-default bg-elevated/30 p-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-sm font-semibold">{{ recording.filename }}</p>
              <p class="text-xs text-dimmed">
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
              <UButton
                v-if="workflowMode"
                size="xs"
                variant="outline"
                :to="`/campaigns/${campaignId}/recordings/${recording.id}?transcribe=1`"
              >
                Transcribe
              </UButton>
              <UButton
                size="xs"
                variant="outline"
                :to="`/campaigns/${campaignId}/recordings/${recording.id}`"
              >
                Open
              </UButton>
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
