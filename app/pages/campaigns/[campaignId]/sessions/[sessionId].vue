<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'
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
const subtitleAttachLoading = ref(false)
const subtitleAttachError = ref('')
const selectedSubtitleRecordingId = ref('')

const setMode = (value: 'overview' | 'workflow') => {
  mode.value = value
  modeLocked.value = true
}

const isEditSessionOpen = ref(false)

const checklistItems = ref([
  { id: 'details', label: 'Session details captured', done: false },
  { id: 'recordings', label: 'Audio/video recordings uploaded', done: false },
  { id: 'transcribe', label: 'Transcription requested from ElevenLabs', done: false },
  { id: 'transcript_received', label: 'Transcript received and saved', done: false },
  { id: 'attach_initial_vtt', label: 'Transcript attached to video (VTT)', done: false },
  { id: 'edit_transcript', label: 'Transcript edits saved in editor', done: false },
  { id: 'attach_final_vtt', label: 'Updated transcript re-attached as VTT', done: false },
  { id: 'send_summary', label: 'Transcript sent to n8n for summary', done: false },
  { id: 'summary_received', label: 'Summary received and saved', done: false },
  { id: 'edit_summary', label: 'Summary edits saved in editor', done: false },
  { id: 'review_links', label: 'Glossary/quests/milestones reviewed and linked', done: false },
  { id: 'send_recap', label: 'Summary sent to ElevenLabs for recap', done: false },
  { id: 'recap_received', label: 'Recap podcast received and saved', done: false },
])

const transcriptForm = reactive({
  content: '',
})
const summaryForm = reactive({
  content: '',
})
const mode = ref<'overview' | 'workflow'>('workflow')
const modeLocked = ref(false)
const activeStep = ref<string>('details')
const stepTouched = ref(false)

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

const sessionDateLabel = computed(() => {
  if (!session.value?.playedAt) return 'Unscheduled'
  return new Date(session.value.playedAt).toLocaleDateString()
})

const recordingsCount = computed(() => recordings.value?.length || 0)
const recapStatus = computed(() => (recap.value ? 'Attached' : 'Missing'))
const transcriptStatus = computed(() => (transcriptDoc.value ? 'Available' : 'Missing'))
const summaryStatus = computed(() => (summaryDoc.value ? 'Available' : 'Missing'))
const hasRecordings = computed(() => (recordings.value?.length || 0) > 0)
const hasTranscript = computed(() => Boolean(transcriptDoc.value))
const hasSummary = computed(() => Boolean(summaryDoc.value))
const hasRecap = computed(() => Boolean(recap.value))
const isSessionComplete = computed(
  () => hasRecordings.value && hasTranscript.value && hasSummary.value
)
const videoOptions = computed(() =>
  (recordings.value || [])
    .filter((recording) => recording.kind === 'VIDEO')
    .map((recording) => ({
      label: recording.filename,
      value: recording.id,
    }))
)

const activePlayback = computed(() => {
  if (recapPlaybackUrl.value) {
    return { kind: 'AUDIO' as const, label: recap.value?.filename || 'Recap', src: recapPlaybackUrl.value }
  }
  const firstRecording = (recordings.value || []).find((recording) => playbackUrls[recording.id])
  if (firstRecording) {
    return {
      kind: firstRecording.kind,
      label: firstRecording.filename,
      src: playbackUrls[firstRecording.id],
    }
  }
  return null
})

const transcriptPreview = computed(() => {
  const value = transcriptDoc.value?.currentVersion?.content || ''
  if (!value) return 'No transcript yet.'
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed
})

const summaryPreview = computed(() => {
  const value = summaryDoc.value?.currentVersion?.content || ''
  if (!value) return 'No summary yet.'
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed
})

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

watch(
  () => isSessionComplete.value,
  (complete) => {
    if (modeLocked.value) return
    mode.value = complete ? 'overview' : 'workflow'
  },
  { immediate: true }
)

const workflowItems = computed<StepperItem[]>(() => [
  {
    title: 'Session details',
    description: hasRecordings.value ? 'Ready to add recordings' : 'Add notes & basics',
    value: 'details',
    icon: 'i-lucide-notebook-pen',
  },
  {
    title: 'Recordings',
    description: hasRecordings.value ? 'Upload complete' : 'Upload audio/video',
    value: 'recordings',
    icon: hasRecordings.value ? 'i-lucide-check-circle' : 'i-lucide-upload',
  },
  {
    title: 'Transcription',
    description: hasTranscript.value ? 'Transcript available' : 'Request transcription',
    value: 'transcription',
    icon: hasTranscript.value ? 'i-lucide-check-circle' : 'i-lucide-wand-2',
  },
  {
    title: 'Transcript edit',
    description: hasTranscript.value ? 'Review & edit transcript' : 'Await transcript',
    value: 'transcript',
    icon: 'i-lucide-file-text',
  },
  {
    title: 'Summary',
    description: hasSummary.value ? 'Summary available' : 'Send to n8n',
    value: 'summary',
    icon: hasSummary.value ? 'i-lucide-check-circle' : 'i-lucide-sparkles',
  },
  {
    title: 'Recap',
    description: hasRecap.value ? 'Recap attached' : 'Create recap podcast',
    value: 'recap',
    icon: hasRecap.value ? 'i-lucide-check-circle' : 'i-lucide-mic',
  },
])

const defaultStep = computed(() => {
  if (!hasRecordings.value) return 'recordings'
  if (!hasTranscript.value) return 'transcription'
  if (!hasSummary.value) return 'summary'
  if (!hasRecap.value) return 'recap'
  return 'details'
})

watch(
  () => defaultStep.value,
  (value) => {
    if (stepTouched.value || mode.value !== 'workflow') return
    activeStep.value = value
  },
  { immediate: true }
)

watch(
  () => videoOptions.value,
  (value) => {
    if (!value.length) {
      selectedSubtitleRecordingId.value = ''
      return
    }
    if (!selectedSubtitleRecordingId.value) {
      selectedSubtitleRecordingId.value = value[0].value
    }
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
    if (isEditSessionOpen.value) isEditSessionOpen.value = false
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

const attachTranscriptToVideo = async () => {
  if (!selectedSubtitleRecordingId.value) return
  subtitleAttachError.value = ''
  subtitleAttachLoading.value = true
  try {
    await request(`/api/recordings/${selectedSubtitleRecordingId.value}/vtt/from-transcript`, {
      method: 'POST',
    })
    await refreshRecordings()
  } catch (error) {
    subtitleAttachError.value =
      (error as Error & { message?: string }).message || 'Unable to attach subtitles.'
  } finally {
    subtitleAttachLoading.value = false
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
  <div class="space-y-8">

    <div v-if="pending" class="grid gap-4">
      <UCard  class="h-28 animate-pulse" />
      <UCard  class="h-40 animate-pulse" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load this session.</p>
      <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
    </UCard>

    <div v-else class="space-y-6">
        <div class="flex flex-wrap items-center justify-end gap-3">
          <UButton size="xl" :to="`/campaigns/${campaignId}`">
            Back to campaign
          </UButton>
          <UButton size="xl" variant="outline" :to="`/campaigns/${campaignId}/sessions`">
            Back to sessions
          </UButton>
        </div>

        <div class="sticky top-[calc(var(--ui-header-height)+1rem)] z-10">
          <UCard>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Session</p>
                <h2 class="text-lg font-semibold">{{ session?.title || 'Session detail' }}</h2>
                <p class="text-xs text-muted">Played at: {{ sessionDateLabel }}</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <UButton size="sm" variant="outline" @click="setMode('workflow')">
                  Continue workflow
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
        <div class="grid gap-4 md:grid-cols-4">
          <UCard :ui="{ body: 'p-4' }">
            <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Recordings</p>
            <p class="mt-2 text-lg font-semibold">{{ recordingsCount }}</p>
            <p class="text-xs text-muted">Uploaded media files.</p>
          </UCard>
          <UCard :ui="{ body: 'p-4' }">
            <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Transcript</p>
            <p class="mt-2 text-lg font-semibold">{{ transcriptStatus }}</p>
            <p class="text-xs text-muted">Transcript document.</p>
          </UCard>
          <UCard :ui="{ body: 'p-4' }">
            <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Summary</p>
            <p class="mt-2 text-lg font-semibold">{{ summaryStatus }}</p>
            <p class="text-xs text-muted">Session summary.</p>
          </UCard>
          <UCard :ui="{ body: 'p-4' }">
            <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Recap</p>
            <p class="mt-2 text-lg font-semibold">{{ recapStatus }}</p>
            <p class="text-xs text-muted">Audio recap status.</p>
          </UCard>
        </div>

        <UCard>
          <template #header>
            <div>
              <h3 class="text-sm font-semibold">Now playing</h3>
              <p class="text-xs text-muted">Quick playback controls.</p>
            </div>
          </template>
          <div class="space-y-3">
            <div v-if="activePlayback" class="space-y-2">
              <p class="text-sm font-semibold">{{ activePlayback.label }}</p>
              <audio
                v-if="activePlayback.kind === 'AUDIO'"
                class="w-full"
                controls
                preload="metadata"
                :src="activePlayback.src"
              />
              <video
                v-else
                class="w-full rounded-lg"
                controls
                preload="metadata"
                :src="activePlayback.src"
              />
            </div>
            <p v-else class="text-sm text-muted">Start playback to pin it here.</p>
          </div>
        </UCard>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <UButton
              size="sm"
              :variant="mode === 'overview' ? 'solid' : 'outline'"
              @click="setMode('overview')"
            >
              Overview
            </UButton>
            <UButton
              size="sm"
              :variant="mode === 'workflow' ? 'solid' : 'outline'"
              @click="setMode('workflow')"
            >
              Workflow
            </UButton>
          </div>
          <span class="text-xs text-dimmed">
            {{ mode === 'overview' ? 'Read-only view of session data.' : 'Guided workflow for completing the session.' }}
          </span>
        </div>

        <div v-if="mode === 'overview'" class="space-y-6">
          <UCard>
            <template #header>
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h2 class="text-lg font-semibold">Session overview</h2>
                  <p class="text-sm text-muted">Key details at a glance.</p>
                </div>
                <UButton size="sm" variant="outline" @click="isEditSessionOpen = true">
                  Edit session
                </UButton>
              </div>
            </template>
            <div class="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Session number</p>
                <p class="mt-1 font-semibold">{{ form.sessionNumber || '?' }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Played at</p>
                <p class="mt-1 font-semibold">{{ form.playedAt || 'Unscheduled' }}</p>
              </div>
              <div class="sm:col-span-2">
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
                <div>
                  <h2 class="text-lg font-semibold">Transcript</h2>
                  <p class="text-sm text-muted">Latest transcript content.</p>
                </div>
              </template>
              <div class="space-y-3">
                <p class="text-sm text-muted">{{ transcriptPreview }}</p>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-if="transcriptDoc"
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
                <div>
                  <h2 class="text-lg font-semibold">Summary</h2>
                  <p class="text-sm text-muted">Current session summary.</p>
                </div>
              </template>
              <div class="space-y-3">
                <p class="text-sm text-muted">{{ summaryPreview }}</p>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-if="summaryDoc"
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

          <UCard>
            <template #header>
              <div>
                <h2 class="text-lg font-semibold">Recordings</h2>
                <p class="text-sm text-muted">Playback available media.</p>
              </div>
            </template>
            <div class="space-y-3">
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

          <UCard>
            <template #header>
              <div>
                <h2 class="text-lg font-semibold">Recap podcast</h2>
                <p class="text-sm text-muted">Listen to the recap audio.</p>
              </div>
            </template>
            <div class="space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <UButton
                  variant="outline"
                  :disabled="!recap"
                  :loading="recapPlaybackLoading"
                  @click="loadRecapPlayback"
                >
                  Play recap
                </UButton>
                <span v-if="recap" class="text-xs text-success">Attached</span>
              </div>
              <UCard v-if="recapPlaybackUrl">
                <audio class="w-full" controls preload="metadata" :src="recapPlaybackUrl" />
              </UCard>
              <p v-if="recapError" class="text-sm text-error">{{ recapError }}</p>
            </div>
          </UCard>
        </div>

        <div v-else class="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <UStepper
            v-model="activeStep"
            :items="workflowItems"
            orientation="vertical"
            class="w-full"
            @update:modelValue="(value) => { activeStep = value as string; stepTouched = true }"
          />
          <div class="space-y-4">
            <div v-if="activeStep === 'details'" class="space-y-4">
              <UCard>
                <template #header>
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <h2 class="text-lg font-semibold">Session details</h2>
                      <p class="text-sm text-muted">Keep the record current.</p>
                    </div>
                    <UButton size="sm" variant="outline" @click="isEditSessionOpen = true">
                      Edit session
                    </UButton>
                  </div>
                </template>
                <div class="space-y-4">
                  <div class="grid gap-4 sm:grid-cols-2 text-sm">
                    <div>
                      <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Session number</p>
                      <p class="mt-1 font-semibold">{{ form.sessionNumber || '?' }}</p>
                    </div>
                    <div>
                      <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Played at</p>
                      <p class="mt-1 font-semibold">{{ form.playedAt || 'Unscheduled' }}</p>
                    </div>
                    <div class="sm:col-span-2">
                      <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Notes</p>
                      <p class="mt-1 text-sm text-muted">
                        {{ form.notes || 'No notes added yet.' }}
                      </p>
                    </div>
                  </div>
                </div>
              </UCard>
              <UCard>
                <template #header>
                  <div>
                    <h3 class="text-sm font-semibold">Session checklist</h3>
                    <p class="text-xs text-muted">Track the workflow steps.</p>
                  </div>
                </template>
                <div class="space-y-2">
                  <div
                    v-for="item in checklistItems"
                    :key="item.id"
                    class="flex items-center gap-2"
                  >
                    <UCheckbox v-model="item.done" />
                    <span class="text-sm">{{ item.label }}</span>
                  </div>
                </div>
              </UCard>
            </div>

            <div v-else-if="activeStep === 'recordings'" class="space-y-4">
              <UCard>
                <template #header>
                  <div>
                    <h2 class="text-lg font-semibold">Recordings</h2>
                    <p class="text-sm text-muted">Upload and review session media.</p>
                  </div>
                </template>
                <div class="space-y-4">
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label class="mb-2 block text-sm text-muted">File</label>
                      <UFileUpload
                        v-model="selectedFile"
                        accept="audio/*,video/*"
                        variant="button"
                        label="Select recording"
                        :preview="false"
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

            <div v-else-if="activeStep === 'transcription'" class="space-y-4">
              <UCard>
                <template #header>
                  <div>
                    <h2 class="text-lg font-semibold">Transcription</h2>
                    <p class="text-sm text-muted">Start transcription from recordings.</p>
                  </div>
                </template>
                <div class="space-y-3">
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
              </UCard>
            </div>

            <div v-else-if="activeStep === 'transcript'" class="space-y-4">
              <UCard>
                <template #header>
                  <div>
                    <h2 class="text-lg font-semibold">Transcript</h2>
                    <p class="text-sm text-muted">
                      Review the transcript and open the editor for full editing.
                    </p>
                  </div>
                </template>
                <div class="space-y-4">
                  <p class="text-sm text-muted">{{ transcriptPreview }}</p>
                  <div class="flex flex-wrap items-center gap-3">
                    <UButton
                      v-if="transcriptDoc"
                      variant="outline"
                      :to="`/campaigns/${campaignId}/documents/${transcriptDoc.id}`"
                    >
                      Open editor
                    </UButton>
                    <UButton
                      v-else
                      variant="outline"
                      @click="saveTranscript"
                    >
                      Create transcript
                    </UButton>
                  </div>
                  <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <UFileUpload
                      v-model="transcriptFile"
                      accept=".txt,.md,.markdown,.vtt"
                      variant="button"
                      label="Select transcript file"
                      :preview="false"
                    />
                    <UButton
                      :loading="transcriptImporting"
                      variant="outline"
                      @click="importTranscript"
                    >
                      Import file
                    </UButton>
                  </div>
                  <div class="flex flex-wrap items-center gap-3">
                    <USelect
                      v-model="selectedSubtitleRecordingId"
                      :items="videoOptions"
                      placeholder="Select video"
                      size="sm"
                    />
                    <UButton
                      variant="outline"
                      :disabled="!selectedSubtitleRecordingId"
                      :loading="subtitleAttachLoading"
                      @click="attachTranscriptToVideo"
                    >
                      Attach subtitles
                    </UButton>
                  </div>
                  <p v-if="transcriptError" class="text-sm text-error">{{ transcriptError }}</p>
                  <p v-if="transcriptImportError" class="text-sm text-error">{{ transcriptImportError }}</p>
                  <p v-if="subtitleAttachError" class="text-sm text-error">{{ subtitleAttachError }}</p>
                </div>
              </UCard>
            </div>

            <div v-else-if="activeStep === 'summary'" class="space-y-4">
              <UCard>
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
                    <UFileUpload
                      v-model="summaryFile"
                      accept=".txt,.md,.markdown"
                      variant="button"
                      label="Select summary file"
                      :preview="false"
                    />
                    <UButton :loading="summaryImporting" variant="outline" @click="importSummary">
                      Import file
                    </UButton>
                  </div>
                  <p v-if="summaryError" class="text-sm text-error">{{ summaryError }}</p>
                  <p v-if="summaryImportError" class="text-sm text-error">{{ summaryImportError }}</p>
                </div>
              </UCard>
            </div>

            <div v-else class="space-y-4">
              <UCard>
                <template #header>
                  <div>
                    <h2 class="text-lg font-semibold">Recap podcast</h2>
                    <p class="text-sm text-muted">
                      Upload a short audio recap for this session.
                    </p>
                  </div>
                </template>
                <div class="space-y-4">
                  <UFileUpload
                    v-model="recapFile"
                    accept="audio/*"
                    variant="button"
                    label="Select recap audio"
                    :preview="false"
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
            </div>
          </div>
        </div>
    </div>

    <UModal v-model:open="isEditSessionOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Edit session</h2>
          </template>
          <div class="space-y-4">
            <div>
              <label class="mb-2 block text-sm text-muted">Title</label>
              <UInput v-model="form.title" />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm text-muted">Session number</label>
                <UInput v-model="form.sessionNumber" type="number" />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">Played at</label>
                <UInput v-model="form.playedAt" type="date" />
              </div>
            </div>
            <div>
              <label class="mb-2 block text-sm text-muted">Notes</label>
              <UTextarea v-model="form.notes" :rows="6" />
            </div>
            <p v-if="saveError" class="text-sm text-error">{{ saveError }}</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="gray" @click="isEditSessionOpen = false">Cancel</UButton>
              <UButton :loading="isSaving" @click="saveSession">Save session</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
