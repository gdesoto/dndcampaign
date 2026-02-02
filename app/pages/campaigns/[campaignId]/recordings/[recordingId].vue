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
  createdAt: string
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const recordingId = computed(() => route.params.recordingId as string)
const { request } = useApi()

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

const { data: transcriptDoc } = await useAsyncData(
  () => `recording-transcript-${recordingId.value}`,
  async () => {
    if (!recording.value?.sessionId) return null
    return request<DocumentDetail | null>(
      `/api/sessions/${recording.value.sessionId}/documents?type=TRANSCRIPT`
    )
  },
  { watch: [recording] }
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
            <audio
              v-else-if="recording.kind === 'AUDIO' && playbackUrl"
              class="w-full"
              controls
              preload="metadata"
              :src="playbackUrl"
            />
            <video
              v-else-if="recording.kind === 'VIDEO' && playbackUrl"
              class="w-full rounded-lg"
              controls
              preload="metadata"
              :src="playbackUrl"
            >
              <track
                v-if="vttUrl"
                kind="subtitles"
                label="Transcript"
                srclang="en"
                :src="vttUrl"
                default
              />
            </video>
            <p v-else class="text-sm text-muted">
              Playback is not available right now.
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
  </UPage>
</template>
