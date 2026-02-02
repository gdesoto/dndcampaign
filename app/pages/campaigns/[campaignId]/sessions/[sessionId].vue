<script setup lang="ts">
definePageMeta({ layout: 'app' })

type SessionDetail = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
  notes?: string | null
}

type RecordingItem = {
  id: string
  kind: 'AUDIO' | 'VIDEO'
  filename: string
  mimeType: string
  byteSize: number
  createdAt: string
  vttArtifactId?: string | null
}

type RecapRecording = {
  id: string
  filename: string
  mimeType: string
  byteSize: number
  createdAt: string
}

type DocumentVersion = {
  id: string
  content: string
  format: 'MARKDOWN' | 'PLAINTEXT'
  versionNumber: number
  source: string
  createdAt: string
}

type DocumentDetail = {
  id: string
  type: 'TRANSCRIPT' | 'SUMMARY' | 'NOTES'
  title: string
  currentVersionId?: string | null
  currentVersion?: DocumentVersion | null
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const sessionId = computed(() => route.params.sessionId as string)
const { request } = useApi()

const { data: session, pending, refresh, error } = await useAsyncData(
  () => `session-${sessionId.value}`,
  () => request<SessionDetail>(`/api/sessions/${sessionId.value}`)
)

const form = reactive({
  title: '',
  sessionNumber: '',
  playedAt: '',
  notes: '',
})
const isSaving = ref(false)
const saveError = ref('')
const uploadError = ref('')
const isUploading = ref(false)
const selectedFile = ref<File | null>(null)
const selectedKind = ref<'AUDIO' | 'VIDEO'>('AUDIO')
const playbackUrls = reactive<Record<string, string>>({})
const playbackLoading = reactive<Record<string, boolean>>({})
const playbackError = ref('')
const recapFile = ref<File | null>(null)
const recapUploading = ref(false)
const recapError = ref('')
const recapPlaybackUrl = ref('')
const recapPlaybackLoading = ref(false)
const recapDeleting = ref(false)
const recapDeleteError = ref('')
const transcriptSaving = ref(false)
const summarySaving = ref(false)
const transcriptError = ref('')
const summaryError = ref('')
const transcriptImportError = ref('')
const summaryImportError = ref('')
const transcriptImporting = ref(false)
const summaryImporting = ref(false)
const transcriptFile = ref<File | null>(null)
const summaryFile = ref<File | null>(null)

const transcriptForm = reactive({
  content: '',
})
const summaryForm = reactive({
  content: '',
})

const { data: recordings, refresh: refreshRecordings } = await useAsyncData(
  () => `recordings-${sessionId.value}`,
  () => request<RecordingItem[]>(`/api/sessions/${sessionId.value}/recordings`)
)

const { data: recap, refresh: refreshRecap } = await useAsyncData(
  () => `recap-${sessionId.value}`,
  () => request<RecapRecording | null>(`/api/sessions/${sessionId.value}/recap`)
)

watch(
  () => recap.value,
  () => {
    recapPlaybackUrl.value = ''
  }
)

const { data: transcriptDoc, refresh: refreshTranscript } = await useAsyncData(
  () => `documents-transcript-${sessionId.value}`,
  () =>
    request<DocumentDetail | null>(
      `/api/sessions/${sessionId.value}/documents?type=TRANSCRIPT`
    )
)

const { data: summaryDoc, refresh: refreshSummary } = await useAsyncData(
  () => `documents-summary-${sessionId.value}`,
  () =>
    request<DocumentDetail | null>(`/api/sessions/${sessionId.value}/documents?type=SUMMARY`)
)

watch(
  () => session.value,
  (value) => {
    form.title = value?.title || ''
    form.sessionNumber = value?.sessionNumber?.toString() || ''
    form.playedAt = value?.playedAt ? value.playedAt.slice(0, 10) : ''
    form.notes = value?.notes || ''
  },
  { immediate: true }
)

watch(
  () => transcriptDoc.value,
  (value) => {
    transcriptForm.content = value?.currentVersion?.content || ''
  },
  { immediate: true }
)

watch(
  () => summaryDoc.value,
  (value) => {
    summaryForm.content = value?.currentVersion?.content || ''
  },
  { immediate: true }
)

const saveSession = async () => {
  saveError.value = ''
  isSaving.value = true
  try {
    await request(`/api/sessions/${sessionId.value}`, {
      method: 'PATCH',
      body: {
        title: form.title || undefined,
        sessionNumber: form.sessionNumber ? Number(form.sessionNumber) : undefined,
        playedAt: form.playedAt ? new Date(form.playedAt).toISOString() : null,
        notes: form.notes || null,
      },
    })
    await refresh()
  } catch (error) {
    saveError.value =
      (error as Error & { message?: string }).message || 'Unable to update session.'
  } finally {
    isSaving.value = false
  }
}

const uploadRecording = async () => {
  if (!selectedFile.value) return
  uploadError.value = ''
  isUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('kind', selectedKind.value)
    await request(`/api/sessions/${sessionId.value}/recordings`, {
      method: 'POST',
      body: formData,
    })
    selectedFile.value = null
    await refreshRecordings()
  } catch (error) {
    uploadError.value =
      (error as Error & { message?: string }).message || 'Unable to upload recording.'
  } finally {
    isUploading.value = false
  }
}

const loadPlayback = async (recordingId: string) => {
  if (playbackUrls[recordingId] || playbackLoading[recordingId]) return
  playbackError.value = ''
  playbackLoading[recordingId] = true
  try {
    const payload = await request<{ url: string }>(
      `/api/recordings/${recordingId}/playback-url`
    )
    playbackUrls[recordingId] = payload.url
  } catch (error) {
    playbackError.value =
      (error as Error & { message?: string }).message || 'Unable to load playback.'
  } finally {
    playbackLoading[recordingId] = false
  }
}

const uploadRecap = async () => {
  if (!recapFile.value) return
  recapError.value = ''
  recapUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', recapFile.value)
    await request(`/api/sessions/${sessionId.value}/recap`, {
      method: 'POST',
      body: formData,
    })
    recapFile.value = null
    await refreshRecap()
  } catch (error) {
    recapError.value =
      (error as Error & { message?: string }).message || 'Unable to upload recap.'
  } finally {
    recapUploading.value = false
  }
}

const loadRecapPlayback = async () => {
  if (!recap.value || recapPlaybackUrl.value || recapPlaybackLoading.value) return
  recapPlaybackLoading.value = true
  try {
    const payload = await request<{ url: string }>(`/api/recaps/${recap.value.id}/playback-url`)
    recapPlaybackUrl.value = payload.url
  } catch (error) {
    recapError.value =
      (error as Error & { message?: string }).message || 'Unable to load recap.'
  } finally {
    recapPlaybackLoading.value = false
  }
}

const deleteRecap = async () => {
  if (!recap.value) return
  recapDeleteError.value = ''
  recapDeleting.value = true
  try {
    await request(`/api/recaps/${recap.value.id}`, {
      method: 'DELETE',
    })
    recapPlaybackUrl.value = ''
    await refreshRecap()
  } catch (error) {
    recapDeleteError.value =
      (error as Error & { message?: string }).message || 'Unable to delete recap.'
  } finally {
    recapDeleting.value = false
  }
}
const createDocument = async (type: 'TRANSCRIPT' | 'SUMMARY', content = '') => {
  const titleBase = type === 'SUMMARY' ? 'Summary' : 'Transcript'
  const title = session.value?.title ? `${titleBase}: ${session.value.title}` : titleBase
  return request<DocumentDetail>(`/api/sessions/${sessionId.value}/documents`, {
    method: 'POST',
    body: {
      type,
      title,
      content,
      format: 'MARKDOWN',
    },
  })
}

const saveTranscript = async () => {
  transcriptError.value = ''
  transcriptSaving.value = true
  try {
    if (!transcriptDoc.value) {
      await createDocument('TRANSCRIPT', transcriptForm.content)
    } else {
      await request(`/api/documents/${transcriptDoc.value.id}`, {
        method: 'PATCH',
        body: {
          content: transcriptForm.content,
          format: 'MARKDOWN',
        },
      })
    }
    await refreshTranscript()
  } catch (error) {
    transcriptError.value =
      (error as Error & { message?: string }).message || 'Unable to save transcript.'
  } finally {
    transcriptSaving.value = false
  }
}

const saveSummary = async () => {
  summaryError.value = ''
  summarySaving.value = true
  try {
    if (!summaryDoc.value) {
      await createDocument('SUMMARY', summaryForm.content)
    } else {
      await request(`/api/documents/${summaryDoc.value.id}`, {
        method: 'PATCH',
        body: {
          content: summaryForm.content,
          format: 'MARKDOWN',
        },
      })
    }
    await refreshSummary()
  } catch (error) {
    summaryError.value =
      (error as Error & { message?: string }).message || 'Unable to save summary.'
  } finally {
    summarySaving.value = false
  }
}

const importDocument = async (
  type: 'TRANSCRIPT' | 'SUMMARY',
  file: File | null,
  setError: (value: string) => void,
  setLoading: (value: boolean) => void,
  refresh: () => Promise<void>
) => {
  if (!file) return
  setError('')
  setLoading(true)
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    await request(`/api/sessions/${sessionId.value}/documents/import`, {
      method: 'POST',
      body: formData,
    })
    await refresh()
  } catch (error) {
    setError((error as Error & { message?: string }).message || 'Import failed.')
  } finally {
    setLoading(false)
  }
}

const importTranscript = async () => {
  await importDocument(
    'TRANSCRIPT',
    transcriptFile.value,
    (value) => {
      transcriptImportError.value = value
    },
    (value) => {
      transcriptImporting.value = value
    },
    refreshTranscript
  )
  transcriptFile.value = null
}

const importSummary = async () => {
  await importDocument(
    'SUMMARY',
    summaryFile.value,
    (value) => {
      summaryImportError.value = value
    },
    (value) => {
      summaryImporting.value = value
    },
    refreshSummary
  )
  summaryFile.value = null
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
  <div class="space-y-8">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Session</p>
        <h1 class="mt-2 text-2xl font-semibold">{{ session?.title || 'Session detail' }}</h1>
      </div>
      <UButton variant="outline" :to="`/campaigns/${campaignId}/sessions`">Back to sessions</UButton>
    </div>

    <div v-if="pending" class="grid gap-4">
      <UCard  class="h-28 animate-pulse" />
      <UCard  class="h-40 animate-pulse" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load this session.</p>
      <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
    </UCard>

    <div v-else class="space-y-6">
      <UCard >
        <template #header>
          <div>
            <h2 class="text-lg font-semibold">Session details</h2>
            <p class="text-sm text-muted">Keep the record current.</p>
          </div>
        </template>
        <div class="space-y-4">
          <div>
            <label class="mb-2 block text-sm text-default">Title</label>
            <UInput v-model="form.title" />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm text-default">Session number</label>
              <UInput v-model="form.sessionNumber" type="number" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-default">Played at</label>
              <UInput v-model="form.playedAt" type="date" />
            </div>
          </div>
          <div>
            <label class="mb-2 block text-sm text-default">Notes</label>
            <UTextarea v-model="form.notes" :rows="6" />
          </div>
          <p v-if="saveError" class="text-sm text-error">{{ saveError }}</p>
        </div>
        <template #footer>
          <div class="flex justify-end">
            <UButton :loading="isSaving" @click="saveSession">Save changes</UButton>
          </div>
        </template>
      </UCard>

      <UCard >
        <template #header>
          <div>
            <h2 class="text-lg font-semibold">Recap podcast</h2>
            <p class="text-sm text-muted">
              Upload a short audio recap for this session.
            </p>
          </div>
        </template>
        <div class="space-y-4">
          <UInput
            type="file"
            accept="audio/*"
            @change="recapFile = ($event.target as HTMLInputElement).files?.[0] || null"
          />
          <div class="flex items-center gap-3">
            <UButton :loading="recapUploading" @click="uploadRecap">Upload recap</UButton>
            <UButton
              variant="outline"
              :disabled="!recap"
              :loading="recapPlaybackLoading"
              @click="loadRecapPlayback"
            >
              Play recap
            </UButton>
            <UButton
              variant="ghost"
              color="red"
              :disabled="!recap"
              :loading="recapDeleting"
              @click="deleteRecap"
            >
              Delete recap
            </UButton>
            <span v-if="recap" class="text-xs text-success">Attached</span>
          </div>
          <UCard v-if="recapPlaybackUrl">
            <audio class="w-full" controls preload="metadata" :src="recapPlaybackUrl" />
          </UCard>
          <p v-if="recapError" class="text-sm text-error">{{ recapError }}</p>
          <p v-if="recapDeleteError" class="text-sm text-error">{{ recapDeleteError }}</p>
        </div>
      </UCard>

      <UCard >
        <template #header>
          <div>
            <h2 class="text-lg font-semibold">Transcript</h2>
            <p class="text-sm text-muted">
              Capture the session transcript or import a file.
            </p>
          </div>
        </template>
        <div class="space-y-4">
          <UTextarea v-model="transcriptForm.content" :rows="6" />
          <div class="flex flex-wrap items-center gap-3">
            <UButton :loading="transcriptSaving" @click="saveTranscript">Save transcript</UButton>
            <UButton
              v-if="transcriptDoc"
              variant="outline"
              :to="`/campaigns/${campaignId}/documents/${transcriptDoc.id}`"
            >
              Open editor
            </UButton>
          </div>
          <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
            <UInput
              type="file"
              accept=".txt,.md,.markdown,.vtt"
              @change="transcriptFile = ($event.target as HTMLInputElement).files?.[0] || null"
            />
            <UButton
              :loading="transcriptImporting"
              variant="outline"
              @click="importTranscript"
            >
              Import file
            </UButton>
          </div>
          <p v-if="transcriptError" class="text-sm text-error">{{ transcriptError }}</p>
          <p v-if="transcriptImportError" class="text-sm text-error">{{ transcriptImportError }}</p>
        </div>
      </UCard>

      <UCard >
        <template #header>
          <div>
            <h2 class="text-lg font-semibold">Summary</h2>
            <p class="text-sm text-muted">
              Write a recap or import one.
            </p>
          </div>
        </template>
        <div class="space-y-4">
          <UTextarea v-model="summaryForm.content" :rows="5" />
          <div class="flex flex-wrap items-center gap-3">
            <UButton :loading="summarySaving" @click="saveSummary">Save summary</UButton>
            <UButton
              v-if="summaryDoc"
              variant="outline"
              :to="`/campaigns/${campaignId}/documents/${summaryDoc.id}`"
            >
              Open editor
            </UButton>
          </div>
          <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
            <UInput
              type="file"
              accept=".txt,.md,.markdown"
              @change="summaryFile = ($event.target as HTMLInputElement).files?.[0] || null"
            />
            <UButton :loading="summaryImporting" variant="outline" @click="importSummary">
              Import file
            </UButton>
          </div>
          <p v-if="summaryError" class="text-sm text-error">{{ summaryError }}</p>
          <p v-if="summaryImportError" class="text-sm text-error">{{ summaryImportError }}</p>
        </div>
      </UCard>

      <UCard >
        <template #header>
          <div>
            <h2 class="text-lg font-semibold">Recordings</h2>
            <p class="text-sm text-muted">Upload and review session media.</p>
          </div>
        </template>
        <div class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm text-default">File</label>
              <UInput
                type="file"
                accept="audio/*,video/*"
                @change="selectedFile = ($event.target as HTMLInputElement).files?.[0] || null"
              />
            </div>
            <div>
              <label class="mb-2 block text-sm text-muted">Kind</label>
              <USelect
                v-model="selectedKind"
                :items="[
                  { label: 'Audio', value: 'AUDIO' },
                  { label: 'Video', value: 'VIDEO' },
                ]"
              />
            </div>
          </div>
          <div class="flex items-center gap-3">
            <UButton :loading="isUploading" @click="uploadRecording">Upload recording</UButton>
            <span v-if="isUploading" class="text-xs text-muted">
              Uploading...
            </span>
            <p v-if="uploadError" class="text-sm text-error">{{ uploadError }}</p>
          </div>
          <p v-if="playbackError" class="text-sm text-error">{{ playbackError }}</p>
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
                    @click="loadPlayback(recording.id)"
                  >
                    Play
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
              <div v-if="playbackUrls[recording.id]" class="mt-3">
                <audio
                  v-if="recording.kind === 'AUDIO'"
                  class="w-full"
                  controls
                  preload="metadata"
                  :src="playbackUrls[recording.id]"
                />
                <video
                  v-else-if="recording.kind === 'VIDEO'"
                  class="w-full rounded-lg"
                  controls
                  preload="metadata"
                  :src="playbackUrls[recording.id]"
                />
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-muted">No recordings yet.</p>
        </div>
      </UCard>
    </div>
  </div>
</template>


