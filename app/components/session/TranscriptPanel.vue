<script setup lang="ts">
type RecordingItem = {
  id: string
  filename: string
}

type TranscriptDoc = {
  id: string
}

const props = defineProps<{
  campaignId: string
  returnToPath?: string
  recordings: RecordingItem[] | null | undefined
  transcriptDoc: TranscriptDoc | null | undefined
  transcriptError: string
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
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
          <h2 class="text-lg font-semibold">Transcript</h2>
          <p class="text-sm text-muted">
            Review the transcript and open the editor for full editing.
          </p>
        </div>
          <UButton
            v-if="transcriptDoc"
            variant="outline"
            size="sm"
            :to="props.returnToPath
              ? {
                  path: `/campaigns/${campaignId}/documents/${transcriptDoc.id}`,
                  query: { returnTo: props.returnToPath },
                }
              : `/campaigns/${campaignId}/documents/${transcriptDoc.id}`"
          >
            Open editor
          </UButton>
        </div>
      </template>
      <div class="space-y-4">
        <UButton
          size="xs"
          variant="outline"
          class="w-full justify-center"
          @click="showFullTranscriptModel = !showFullTranscriptModel"
        >
          {{ showFullTranscriptModel ? 'Hide full transcript' : 'Show full transcript' }}
        </UButton>
        <p
          class="whitespace-pre-line text-sm text-muted"
          :class="showFullTranscriptModel ? 'max-h-96 overflow-y-auto' : ''"
        >
          {{ showFullTranscriptModel ? fullTranscript : transcriptPreview }}
        </p>
        <div class="rounded-lg border border-dashed border-muted-200 p-4">
          <div class="space-y-3">
            <p class="text-sm font-semibold">Attach subtitles to a video</p>
            <p class="text-sm text-muted">
              Do this after a transcript has been added.
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <USelect
                v-model="selectedSubtitleRecordingIdModel"
                :items="videoOptions"
                placeholder="Select video"
                size="sm"
              />
              <UButton
                variant="outline"
                :disabled="!selectedSubtitleRecordingIdModel"
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
      </div>
    </UCard>
    <UCard>
      <template #header>
        <div>
          <h2 class="text-lg font-semibold">Transcription tools</h2>
          <p class="text-sm text-muted">
            Start transcription, create/import a transcript, or attach subtitles.
          </p>
        </div>
      </template>
      <div class="space-y-4">
        <div class="grid gap-4 lg:grid-cols-3">
          <div class="rounded-lg border border-dashed border-muted-200 p-4">
            <div class="space-y-2">
              <p class="text-sm font-semibold">1. Start from a recording</p>
              <p class="text-sm text-muted">
                Open a recording to start transcription and monitor jobs.
              </p>
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-for="recording in recordings || []"
                  :key="recording.id"
                  size="sm"
                  variant="outline"
                  :to="`/campaigns/${campaignId}/recordings/${recording.id}?transcribe=1`"
                >
                  Transcribe {{ recording.filename }}
                </UButton>
              </div>
            </div>
          </div>
          <div class="rounded-lg border border-dashed border-muted-200 p-4">
            <div class="space-y-3">
              <p class="text-sm font-semibold">2. Create a transcript from scratch</p>
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
          <div class="rounded-lg border border-dashed border-muted-200 p-4">
            <div class="space-y-3">
              <p class="text-sm font-semibold">3. Import a transcript file</p>
              <div class="grid gap-3">
                <UFileUpload
                  v-model="transcriptFileModel"
                  accept=".txt,.md,.markdown,.vtt"
                  variant="button"
                  label="Select transcript file"
                  :preview="false"
                />
                <UButton
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
