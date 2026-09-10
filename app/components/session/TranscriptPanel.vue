<script setup lang="ts">
type RecordingItem = {
  id: string
  filename: string
}

type TranscriptDoc = {
  id: string
}

const props = defineProps<{
  deleteTranscript?: () => Promise<unknown>
  campaignId: string
  returnToPath?: string
  canManageTranscript?: boolean
  recordings: RecordingItem[] | null | undefined
  transcriptDoc: TranscriptDoc | null | undefined
  transcriptError: string
  transcriptDeleteError?: string
  transcriptDeleting?: boolean
  transcriptImportError: string
  transcriptImporting: boolean
  transcriptFile: File | null
  showFullTranscript: boolean
  transcriptPreview: string
  fullTranscript: string
  selectedSubtitleRecordingId: string
  videoOptions: Array<{ label: string; value: string }>
  subtitleAttachLoading: boolean
  subtitleAttachError: string
}>()

const emit = defineEmits<{
  'update:transcriptFile': [value: File | null]
  'update:showFullTranscript': [value: boolean]
  'update:selectedSubtitleRecordingId': [value: string]
  'create-transcript': []
  'import-transcript': []
  'attach-subtitles': []
}>()

const transcriptFileModel = computed({
  get: () => props.transcriptFile,
  set: (value: File | null | undefined) => emit('update:transcriptFile', value ?? null),
})

const showFullTranscriptModel = computed({
  get: () => props.showFullTranscript,
  set: (value: boolean) => emit('update:showFullTranscript', value),
})

const selectedSubtitleRecordingIdModel = computed({
  get: () => props.selectedSubtitleRecordingId,
  set: (value: string | number | undefined) => emit('update:selectedSubtitleRecordingId', String(value || '')),
})
</script>

<template>
  <div class="space-y-4">
    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <h2 class=" type-section">Transcript</h2>
            <p class="text-sm text-muted">
              Review the transcript and open the editor for full editing.
            </p>
          </div>
          <div class="ml-auto flex items-center justify-end gap-2">
            <UButton
              v-if="transcriptDoc"
              variant="outline"
              size="sm"
              :to="`/campaigns/${campaignId}/documents/${transcriptDoc.id}`"
            >
              Open editor
            </UButton>
            <SharedConfirmActionPopover
              v-if="transcriptDoc && canManageTranscript && deleteTranscript"
              message="Delete the current transcript document? This permanently removes the transcript and its versions."
              confirm-label="Delete transcript"
              confirm-icon="i-lucide-trash-2"
              :confirm-loading="transcriptDeleting"
              :action="deleteTranscript"
            >
              <template #trigger>
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :loading="transcriptDeleting"
                >
                  Delete transcript
                </UButton>
              </template>
            </SharedConfirmActionPopover>
          </div>
        </div>
      </template>
      <div class="space-y-4">
        <UButton
          v-if="transcriptDoc"
          size="xs"
          variant="outline"
          :aria-expanded="showFullTranscriptModel"
          class="justify-center"
          @click="() => { showFullTranscriptModel = !showFullTranscriptModel }"
        >
          {{ showFullTranscriptModel ? 'Hide full transcript' : 'Show full transcript' }}
        </UButton>
        <p
          class="whitespace-pre-line reading-copy text-default wrap-anywhere"
          :class="showFullTranscriptModel ? 'max-h-96 overflow-y-auto' : ''"
        >
          {{ showFullTranscriptModel ? fullTranscript : transcriptPreview }}
        </p>
        <div v-if="canManageTranscript" class="rounded-lg bg-accented/40 p-4">
          <div class="space-y-3">
            <p class="text-sm font-semibold">Attach subtitles to a video</p>
            <p class="text-sm text-muted">
              {{ !transcriptDoc ? 'Add a transcript before attaching subtitles.' : !videoOptions.length ? 'Upload a video recording to attach subtitles.' : 'Use the saved transcript as captions for this video.' }}
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <USelect
                v-model="selectedSubtitleRecordingIdModel"
                :items="videoOptions"
                aria-label="Video for subtitles"
                placeholder="Select video"
                size="sm"
              />
              <UButton
                variant="outline"
                :disabled="!canManageTranscript || !transcriptDoc || !selectedSubtitleRecordingIdModel || transcriptDeleting"
                :loading="subtitleAttachLoading"
                @click="emit('attach-subtitles')"
              >
                Attach subtitles
              </UButton>
            </div>
            <p v-if="subtitleAttachError" class="text-sm text-error">
              {{ subtitleAttachError }}
            </p>
          </div>
        </div>
        <p v-if="transcriptDeleteError" class="text-sm text-error">
          {{ transcriptDeleteError }}
        </p>
      </div>
    </UCard>
    <UCard v-if="canManageTranscript" variant="soft">
      <template #header>
        <div>
          <h2 class=" type-section">Transcription tools</h2>
          <p class="text-sm text-muted">
            Start transcription, create/import a transcript, or attach subtitles.
          </p>
        </div>
      </template>
      <div class="space-y-4">
        <div class="grid gap-4 lg:grid-cols-3">
          <div class="rounded-lg bg-accented/40 p-4">
            <div class="space-y-2">
              <p class="text-sm font-semibold">From a recording</p>
              <p class="text-sm text-muted">
                Open a recording to start transcription and monitor jobs.
              </p>
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-for="recording in recordings || []"
                  :key="recording.id"
                  size="sm"
                  variant="outline"
                  class="max-w-full whitespace-normal text-left wrap-anywhere"
                  :to="`/campaigns/${campaignId}/recordings/${recording.id}?transcribe=1`"
                >
                  Transcribe {{ recording.filename }}
                </UButton>
              </div>
            </div>
          </div>
          <div class="rounded-lg bg-accented/40 p-4">
            <div class="space-y-3">
              <p class="text-sm font-semibold">Write from scratch</p>
              <UButton
                variant="outline"
                class="w-full justify-center"
                @click="emit('create-transcript')"
              >
                Create transcript
              </UButton>
              <p v-if="transcriptError" class="text-sm text-error">{{ transcriptError }}</p>
            </div>
          </div>
          <div class="rounded-lg bg-accented/40 p-4">
            <div class="space-y-3">
              <p class="text-sm font-semibold">Import a file</p>
              <div class="grid gap-3">
                <SharedFilePicker
                  v-model="transcriptFileModel"
                  :disabled="transcriptImporting || transcriptDeleting"
                  accept=".txt,.md,.markdown,.vtt"
                  label="Select transcript file"
                />
                <UButton
                  :disabled="!transcriptFile || transcriptDeleting"
                  :loading="transcriptImporting"
                  variant="outline"
                  class="w-full justify-center"
                  @click="emit('import-transcript')"
                >
                  Import file
                </UButton>
              </div>
              <p v-if="transcriptImportError" class="text-sm text-error">
                {{ transcriptImportError }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
