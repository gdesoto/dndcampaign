<script setup lang="ts">
definePageMeta({ layout: 'app' })

type RecordingDetail = {
  id: string
  sessionId: string
  kind: 'AUDIO' | 'VIDEO'
  filename: string
  mimeType: string
  byteSize: number
  durationSeconds?: number | null
  artifactId: string
  vttArtifactId?: string | null
  createdAt: string
}

type DocumentVersion = {
  content: string
}

type DocumentDetail = {
  id: string
  currentVersion?: DocumentVersion | null
}

type ArtifactDetail = {
  id: string
  storageKey: string
  mimeType?: string
  byteSize?: number
  createdAt: string
}

type SessionRecording = {
  id: string
  kind: 'AUDIO' | 'VIDEO'
  filename: string
  createdAt: string
}

type TranscriptionArtifact = {
  id: string
  format: 'TXT' | 'SRT' | 'DOCX' | 'PDF' | 'HTML' | 'SEGMENTED_JSON'
  artifact: ArtifactDetail
}

type TranscriptionJob = {
  id: string
  status: string
  externalJobId?: string | null
  requestedFormats: string[]
  errorMessage?: string | null
  createdAt: string
  completedAt?: string | null
  artifacts: TranscriptionArtifact[]
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const recordingId = computed(() => route.params.recordingId as string)
const { request } = useApi()
const player = useMediaPlayer()

const { data: recording, pending, refresh, error } = await useAsyncData(
  () => `recording-${recordingId.value}`,
  () => request<RecordingDetail>(`/api/recordings/${recordingId.value}`)
)

const { data: playbackUrl, pending: playbackPending } = await useAsyncData(
  () => `recording-playback-${recordingId.value}`,
  async () => {
    const payload = await request<{ url: string }>(
      `/api/recordings/${recordingId.value}/playback-url`
    )
    return payload.url
  }
)

const { data: transcriptDoc, refresh: refreshTranscript } = await useAsyncData(
  () => `recording-transcript-${recordingId.value}`,
  async () => {
    if (!recording.value?.sessionId) return null
    return request<DocumentDetail | null>(
      `/api/sessions/${recording.value.sessionId}/documents?type=TRANSCRIPT`
    )
  },
  { watch: [recording] }
)

const { data: sessionRecordings } = await useAsyncData(
  () => `session-recordings-${recordingId.value}`,
  async () => {
    if (!recording.value?.sessionId) return []
    return request<SessionRecording[]>(
      `/api/sessions/${recording.value.sessionId}/recordings`
    )
  },
  { watch: [recording] }
)

const videoOptions = computed(() =>
  (sessionRecordings.value || [])
    .filter((item) => item.kind === 'VIDEO')
    .map((item) => ({
      label: item.filename,
      value: item.id,
    }))
)

const vttUrl = computed(() =>
  recording.value?.vttArtifactId
    ? `/api/artifacts/${recording.value.vttArtifactId}/stream`
    : ''
)
const vttFileName = computed(() => {
  const key = vttArtifact.value?.storageKey
  if (!key) return ''
  const parts = key.split('/')
  return parts[parts.length - 1] || key
})
const vttFile = ref<File | null>(null)
const vttUploading = ref(false)
const vttError = ref('')
const transcriptAttachLoading = ref(false)
const transcriptAttachError = ref('')
const detachLoading = ref(false)
const detachError = ref('')
const transcribeModalOpen = ref(false)
const transcribeLoading = ref(false)
const transcribeError = ref('')
const transcribeActionError = ref('')
const selectedVideoByArtifact = reactive<Record<string, string>>({})

const transcribeForm = reactive({
  numSpeakers: '12',
  diarize: true,
  keyterms: '',
  formats: {
    txt: true,
    srt: true,
    docx: false,
    pdf: false,
    html: false,
    segmented_json: false,
  },
})

const uploadVtt = async () => {
  if (!vttFile.value) return
  vttError.value = ''
  vttUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', vttFile.value)
    await request(`/api/recordings/${recordingId.value}/vtt`, {
      method: 'POST',
      body: formData,
    })
    vttFile.value = null
    await refresh()
    await refreshVttHistory()
  } catch (error) {
    vttError.value =
      (error as Error & { message?: string }).message || 'Unable to upload subtitles.'
  } finally {
    vttUploading.value = false
  }
}

const attachFromTranscript = async () => {
  transcriptAttachError.value = ''
  transcriptAttachLoading.value = true
  try {
    await request(`/api/recordings/${recordingId.value}/vtt/from-transcript`, {
      method: 'POST',
    })
    await refresh()
    await refreshVttHistory()
  } catch (error) {
    transcriptAttachError.value =
      (error as Error & { message?: string }).message || 'Unable to attach transcript.'
  } finally {
    transcriptAttachLoading.value = false
  }
}

const { data: vttArtifact } = await useAsyncData(
  () => `recording-vtt-${recordingId.value}`,
  async () => {
    if (!recording.value?.vttArtifactId) return null
    return request<ArtifactDetail>(`/api/artifacts/${recording.value.vttArtifactId}`)
  },
  { watch: [recording] }
)

const { data: vttHistory, refresh: refreshVttHistory } = await useAsyncData(
  () => `recording-vtt-history-${recordingId.value}`,
  async () => {
    if (!recording.value) return []
    return request<ArtifactDetail[]>(`/api/recordings/${recordingId.value}/vtt/history`)
  },
  { watch: [recording] }
)

const { data: transcriptionJobs, refresh: refreshTranscriptions } = await useAsyncData(
  () => `recording-transcriptions-${recordingId.value}`,
  async () => {
    if (!recording.value) return []
    return request<TranscriptionJob[]>(`/api/recordings/${recordingId.value}/transcriptions`)
  },
  { watch: [recording] }
)

watch(
  () => [transcriptionJobs.value, videoOptions.value],
  () => {
    if (!transcriptionJobs.value?.length || !videoOptions.value.length) return
    for (const job of transcriptionJobs.value) {
      for (const artifact of job.artifacts || []) {
        if (
          artifact.format === 'SRT' &&
          !selectedVideoByArtifact[artifact.artifact.id]
        ) {
          selectedVideoByArtifact[artifact.artifact.id] = videoOptions.value[0].value
        }
      }
    }
  },
  { immediate: true }
)

watch(
  () => route.query.transcribe,
  (value) => {
    if (value) {
      transcribeModalOpen.value = true
    }
  },
  { immediate: true }
)

const detachSubtitles = async () => {
  if (!recording.value?.vttArtifactId) return
  detachError.value = ''
  detachLoading.value = true
  try {
    await request(`/api/recordings/${recordingId.value}/vtt`, {
      method: 'DELETE',
    })
    await refresh()
    await refreshVttHistory()
  } catch (error) {
    detachError.value =
      (error as Error & { message?: string }).message || 'Unable to detach subtitles.'
  } finally {
    detachLoading.value = false
  }
}

const buildTranscribeFormats = () =>
  Object.entries(transcribeForm.formats)
    .filter(([, enabled]) => enabled)
    .map(([format]) => format)

const parseKeyterms = (value: string) =>
  value
    .split(/[\n,]/)
    .map((term) => term.trim())
    .filter(Boolean)

const startTranscription = async () => {
  if (!recording.value) return
  transcribeError.value = ''
  transcribeLoading.value = true
  try {
    const formats = buildTranscribeFormats()
    if (!formats.length) {
      transcribeError.value = 'Select at least one output format.'
      return
    }
    const numSpeakers = Number(transcribeForm.numSpeakers)
    const payload = {
      formats,
      numSpeakers: Number.isFinite(numSpeakers) ? numSpeakers : undefined,
      keyterms: parseKeyterms(transcribeForm.keyterms),
      diarize: transcribeForm.diarize,
    }
    await request(`/api/recordings/${recordingId.value}/transcribe`, {
      method: 'POST',
      body: payload,
    })
    await refreshTranscriptions()
    transcribeModalOpen.value = false
  } catch (error) {
    transcribeError.value =
      (error as Error & { message?: string }).message || 'Unable to start transcription.'
  } finally {
    transcribeLoading.value = false
  }
}

const fetchTranscription = async (jobId: string) => {
  transcribeActionError.value = ''
  try {
    await request(`/api/transcriptions/${jobId}/fetch`, {
      method: 'POST',
    })
    await refreshTranscriptions()
  } catch (error) {
    transcribeActionError.value =
      (error as Error & { message?: string }).message || 'Unable to fetch transcription.'
  }
}

const applyTranscript = async (jobId: string, artifactId: string) => {
  transcribeActionError.value = ''
  try {
    await request(`/api/transcriptions/${jobId}/apply-transcript`, {
      method: 'POST',
      body: { artifactId },
    })
    await refreshTranscript()
  } catch (error) {
    transcribeActionError.value =
      (error as Error & { message?: string }).message || 'Unable to apply transcript.'
  }
}

const attachSubtitlesFromArtifact = async (jobId: string, artifactId: string) => {
  transcribeActionError.value = ''
  try {
    const recordingId = selectedVideoByArtifact[artifactId]
    await request(`/api/transcriptions/${jobId}/attach-vtt`, {
      method: 'POST',
      body: { artifactId, recordingId },
    })
    await refresh()
    await refreshVttHistory()
  } catch (error) {
    transcribeActionError.value =
      (error as Error & { message?: string }).message || 'Unable to attach subtitles.'
  }
}

const startPlayback = async () => {
  if (!recording.value || !playbackUrl.value) return
  await player.playSource(
    {
      id: recording.value.id,
      title: recording.value.filename,
      subtitle: recording.value.kind,
      kind: recording.value.kind,
      src: playbackUrl.value,
      vttUrl: vttUrl.value || undefined,
    },
    { presentation: 'page' }
  )
}

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
  <UPage>
    <div class="space-y-8">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-dimmed">
            Recording
          </p>
          <h1 class="mt-2 text-2xl font-semibold">{{ recording?.filename || 'Recording detail' }}</h1>
        </div>
        <div class="flex flex-wrap gap-3">
          <UButton
            v-if="recording"
            variant="outline"
            :to="`/campaigns/${campaignId}/sessions/${recording.sessionId}`"
          >
            Back to session
          </UButton>
          <UButton variant="outline" :to="`/campaigns/${campaignId}/sessions`">
            All sessions
          </UButton>
        </div>
      </div>

      <div v-if="pending" class="grid gap-4">
        <UCard  class="h-32 animate-pulse" />
        <UCard  class="h-52 animate-pulse" />
      </div>

      <UCard v-else-if="error" class="text-center">
        <p class="text-sm text-error">Unable to load this recording.</p>
        <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
      </UCard>

      <div v-else-if="recording" class="space-y-6">
        <UCard >
          <template #header>
            <div>
              <h2 class="text-lg font-semibold">Playback</h2>
              <p class="text-sm text-muted">
                Streamed directly from storage.
              </p>
            </div>
          </template>
          <div class="space-y-4">
            <div v-if="playbackPending" class="text-sm text-muted">
              Preparing playback...
            </div>
            <div v-else-if="playbackUrl" class="space-y-3">
              <UButton size="sm" variant="outline" @click="startPlayback">
                Play in page player
              </UButton>
              <MediaPlayerDock dock-id="recording-player-dock" mode="page" />
            </div>
            <p v-else class="text-sm text-muted">
              Playback is not available right now.
            </p>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="text-lg font-semibold">Transcription</h2>
                <p class="text-sm text-muted">
                  Start a speech-to-text job and review outputs.
                </p>
              </div>
              <UButton size="sm" variant="outline" @click="transcribeModalOpen = true">
                Start transcription
              </UButton>
            </div>
          </template>
          <div class="space-y-3">
            <div
              v-for="job in transcriptionJobs"
              :key="job.id"
              class="rounded-lg border border-default bg-elevated/30 p-4 text-sm"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="font-semibold">Status: {{ job.status }}</p>
                  <p class="text-xs text-dimmed">
                    {{ new Date(job.createdAt).toLocaleString() }}
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2 text-xs text-dimmed">
                  <span>Formats: {{ job.requestedFormats?.join(', ') || '—' }}</span>
                  <UButton
                    v-if="job.externalJobId && job.status !== 'COMPLETED'"
                    size="xs"
                    variant="ghost"
                    @click="fetchTranscription(job.id)"
                  >
                    Fetch from ElevenLabs
                  </UButton>
                </div>
              </div>
              <div v-if="job.artifacts?.length" class="mt-3 space-y-2">
                <div
                  v-for="artifact in job.artifacts"
                  :key="artifact.id"
                  class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-default bg-default/40 px-3 py-2"
                >
                  <div>
                    <p class="text-xs uppercase tracking-[0.2em] text-dimmed">
                      {{ artifact.format }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ new Date(artifact.artifact.createdAt).toLocaleString() }}
                    </p>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <UButton
                      v-if="artifact.format === 'TXT'"
                      size="xs"
                      variant="outline"
                      @click="applyTranscript(job.id, artifact.artifact.id)"
                    >
                      Use as transcript
                    </UButton>
                    <UButton
                      v-if="artifact.format === 'SRT'"
                      size="xs"
                      variant="outline"
                      :disabled="!selectedVideoByArtifact[artifact.artifact.id]"
                      @click="attachSubtitlesFromArtifact(job.id, artifact.artifact.id)"
                    >
                      Attach subtitles
                    </UButton>
                    <USelect
                      v-if="artifact.format === 'SRT'"
                      v-model="selectedVideoByArtifact[artifact.artifact.id]"
                      size="xs"
                      :items="videoOptions"
                      placeholder="Select video"
                    />
                    <UButton
                      size="xs"
                      variant="ghost"
                      :to="`/api/artifacts/${artifact.artifact.id}/stream`"
                      target="_blank"
                    >
                      Download
                    </UButton>
                  </div>
                </div>
              </div>
              <p v-else class="mt-2 text-xs text-muted">Waiting for artifacts.</p>
              <p v-if="job.errorMessage" class="mt-2 text-xs text-error">
                {{ job.errorMessage }}
              </p>
            </div>
            <p v-if="!transcriptionJobs?.length" class="text-sm text-muted">
              No transcription jobs yet.
            </p>
            <p v-if="transcribeActionError" class="text-sm text-error">
              {{ transcribeActionError }}
            </p>
          </div>
        </UCard>

        <UCard
          v-if="recording.kind === 'VIDEO'"
          
        >
          <template #header>
            <div>
              <h2 class="text-lg font-semibold">Subtitles (VTT)</h2>
              <p class="text-sm text-muted">
                Upload a WebVTT file to display subtitles during playback.
              </p>
            </div>
          </template>
          <div class="space-y-3">
            <UInput
              type="file"
              accept=".vtt,.srt,text/vtt"
              @change="vttFile = ($event.target as HTMLInputElement).files?.[0] || null"
            />
            <div class="flex flex-wrap items-center gap-3">
              <UButton :loading="vttUploading" variant="outline" @click="uploadVtt">
                Upload subtitles
              </UButton>
              <UButton
                variant="outline"
                :disabled="!transcriptDoc?.currentVersion?.content"
                :loading="transcriptAttachLoading"
                @click="attachFromTranscript"
              >
                Import session transcript
              </UButton>
              <UButton
                variant="ghost"
                color="red"
                :disabled="!recording?.vttArtifactId"
                :loading="detachLoading"
                @click="detachSubtitles"
              >
                Detach subtitles
              </UButton>
              <span v-if="vttUrl" class="text-xs text-success">Attached</span>
            </div>
            <div
              v-if="vttArtifact"
              class="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success"
            >
              Current subtitles: {{ vttFileName }}
            </div>
            <div v-if="vttHistory?.length" class="space-y-2 rounded-md border border-default bg-elevated/30 px-3 py-2 text-xs text-default">
              <p class="text-[11px] uppercase tracking-[0.2em] text-dimmed">Subtitle history</p>
              <div
                v-for="item in vttHistory"
                :key="item.id"
                class="flex items-center justify-between gap-2"
              >
                <div>
                  <p class="font-semibold">
                    {{ item.storageKey.split('/').pop() }}
                  </p>
                  <p class="text-[11px] text-dimmed">
                    {{ new Date(item.createdAt).toLocaleString() }}
                  </p>
                </div>
                <span
                  v-if="item.id === recording?.vttArtifactId"
                  class="rounded-full bg-success/20 px-2 py-0.5 text-[11px] text-success"
                >
                  In use
                </span>
              </div>
            </div>
            <p v-if="vttError" class="text-sm text-error">{{ vttError }}</p>
            <p v-if="transcriptAttachError" class="text-sm text-error">
              {{ transcriptAttachError }}
            </p>
            <p v-if="detachError" class="text-sm text-error">
              {{ detachError }}
            </p>
          </div>
        </UCard>

        <UCard >
          <template #header>
            <div>
              <h2 class="text-lg font-semibold">Details</h2>
              <p class="text-sm text-muted">Recording metadata.</p>
            </div>
          </template>
          <div class="grid gap-4 text-sm text-default sm:grid-cols-2">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Kind</p>
              <p class="mt-1 font-semibold">{{ recording.kind }}</p>
            </div>
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Size</p>
              <p class="mt-1 font-semibold">{{ formatBytes(recording.byteSize) }}</p>
            </div>
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Mime type</p>
              <p class="mt-1 font-semibold">{{ recording.mimeType }}</p>
            </div>
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Uploaded</p>
              <p class="mt-1 font-semibold">{{ new Date(recording.createdAt).toLocaleString() }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <UModal v-model:open="transcribeModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div>
              <h2 class="text-lg font-semibold">Start transcription</h2>
              <p class="text-sm text-muted">
                Configure the ElevenLabs transcription request.
              </p>
            </div>
          </template>
          <div class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm text-muted">Speakers</label>
                <UInput v-model="transcribeForm.numSpeakers" type="number" min="1" max="32" />
              </div>
              <div class="flex items-center gap-2">
                <UCheckbox v-model="transcribeForm.diarize" />
                <span class="text-sm">Enable diarization</span>
              </div>
            </div>
            <div>
              <label class="mb-2 block text-sm text-muted">Keyterms</label>
              <UTextarea
                v-model="transcribeForm.keyterms"
                :rows="3"
                placeholder="Comma or line separated terms to bias the transcript."
              />
            </div>
            <div>
              <p class="mb-2 text-sm text-muted">Formats</p>
              <div class="grid gap-2 sm:grid-cols-2">
                <label class="flex items-center gap-2 text-sm">
                  <UCheckbox v-model="transcribeForm.formats.txt" /> TXT
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <UCheckbox v-model="transcribeForm.formats.srt" /> SRT
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <UCheckbox v-model="transcribeForm.formats.docx" /> DOCX
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <UCheckbox v-model="transcribeForm.formats.pdf" /> PDF
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <UCheckbox v-model="transcribeForm.formats.html" /> HTML
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <UCheckbox v-model="transcribeForm.formats.segmented_json" /> Segmented JSON
                </label>
              </div>
            </div>
            <p v-if="transcribeError" class="text-sm text-error">{{ transcribeError }}</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="gray" @click="transcribeModalOpen = false">
                Cancel
              </UButton>
              <UButton :loading="transcribeLoading" @click="startTranscription">
                Start transcription
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UPage>
</template>
