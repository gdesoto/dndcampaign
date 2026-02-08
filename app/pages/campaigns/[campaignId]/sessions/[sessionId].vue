<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'
import type { TimelineItem } from '@nuxt/ui'
import {
  isSegmentedTranscript,
  parseTranscriptSegments,
  segmentsToPlainText,
} from '#shared/utils/transcript'
definePageMeta({ layout: 'app' })

type SessionDetail = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
  guestDungeonMasterName?: string | null
  campaign?: {
    dungeonMasterName?: string | null
  } | null
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

type SummaryJob = {
  id: string
  status: string
  mode: string
  trackingId: string
  promptProfile?: string | null
  summaryDocumentId?: string | null
  createdAt: string
  updatedAt: string
  meta?: Record<string, unknown> | null
}

type SummaryJobListItem = {
  id: string
  status: string
  mode: string
  trackingId: string
  summaryDocumentId?: string | null
  createdAt: string
  updatedAt: string
}

type SummarySuggestion = {
  id: string
  entityType: string
  action: string
  status: string
  match?: Record<string, unknown> | null
  payload: Record<string, unknown>
}

type SummaryJobResponse = {
  job: SummaryJob | null
  suggestions: SummarySuggestion[]
  jobs: SummaryJobListItem[]
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const sessionId = computed(() => route.params.sessionId as string)
const { request } = useApi()
const player = useMediaPlayer()

const { data: session, pending, refresh, error } = await useAsyncData(
  () => `session-${sessionId.value}`,
  () => request<SessionDetail>(`/api/sessions/${sessionId.value}`)
)

const form = reactive({
  title: '',
  sessionNumber: '',
  playedAt: '',
  guestDungeonMasterName: '',
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
const summarySending = ref(false)
const summarySendError = ref('')
const summaryActionError = ref('')
const selectedSummaryJobId = ref('')
const subtitleAttachLoading = ref(false)
const subtitleAttachError = ref('')
const selectedSubtitleRecordingId = ref('')
const showFullTranscript = ref(false)

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

const { data: summaryJobData, refresh: refreshSummaryJob } = await useAsyncData(
  () => `summary-job-${sessionId.value}`,
  () => request<SummaryJobResponse>(`/api/sessions/${sessionId.value}/summary-jobs`)
)

const { data: selectedSummaryJobData, refresh: refreshSelectedSummaryJob } = await useAsyncData(
  () => `summary-job-detail-${selectedSummaryJobId.value || 'latest'}`,
  () => {
    if (!selectedSummaryJobId.value) return Promise.resolve(null)
    return request<SummaryJob & { suggestions: SummarySuggestion[] }>(
      `/api/summary-jobs/${selectedSummaryJobId.value}`
    )
  },
  { immediate: false }
)

watch(
  () => session.value,
  (value) => {
    form.title = value?.title || ''
    form.sessionNumber = value?.sessionNumber?.toString() || ''
    form.playedAt = value?.playedAt ? value.playedAt.slice(0, 10) : ''
    form.guestDungeonMasterName = value?.guestDungeonMasterName || ''
    form.notes = value?.notes || ''
  },
  { immediate: true }
)

const sessionDateLabel = computed(() => {
  if (!session.value?.playedAt) return 'Unscheduled'
  return new Date(session.value.playedAt).toLocaleDateString()
})

const sessionDungeonMasterLabel = computed(() =>
  session.value?.guestDungeonMasterName
  || session.value?.campaign?.dungeonMasterName
  || 'None'
)

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
const summaryJob = computed(() => {
  if (selectedSummaryJobId.value && selectedSummaryJobData.value) {
    return selectedSummaryJobData.value
  }
  return summaryJobData.value?.job || null
})
const summarySuggestions = computed(() => {
  if (selectedSummaryJobId.value && selectedSummaryJobData.value) {
    return selectedSummaryJobData.value.suggestions || []
  }
  return summaryJobData.value?.suggestions || []
})
const summaryJobHistory = computed(() => summaryJobData.value?.jobs || [])
const sessionSuggestion = computed(() =>
  summarySuggestions.value.find((suggestion) => suggestion.entityType === 'SESSION') || null
)
const summaryJobOptions = computed(() =>
  summaryJobHistory.value.map((job) => {
    const dateLabel = new Date(job.createdAt).toLocaleString()
    return {
      label: `${dateLabel} · ${job.status}`,
      value: job.id,
    }
  })
)

watch(
  () => summaryJobData.value?.job?.id,
  (value) => {
    if (!selectedSummaryJobId.value && value) {
      selectedSummaryJobId.value = value
    }
  },
  { immediate: true }
)

watch(
  () => selectedSummaryJobId.value,
  async (value) => {
    if (!value) return
    await refreshSelectedSummaryJob()
  }
)
const videoOptions = computed(() =>
  (recordings.value || [])
    .filter((recording) => recording.kind === 'VIDEO')
    .map((recording) => ({
      label: recording.filename,
      value: recording.id,
    }))
)

const activePlayback = computed(() => player.state.value.source)

const transcriptPreview = computed(() => {
  const value = transcriptDoc.value?.currentVersion?.content || ''
  if (!value) return 'No transcript yet.'
  const trimmed = value.trim()
  if (isSegmentedTranscript(trimmed)) {
    const segments = parseTranscriptSegments(trimmed)
    const preview = segmentsToPlainText(segments.slice(0, 3), { includeDisabled: false })
    return preview || 'No transcript yet.'
  }
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed
})

const fullTranscript = computed(() => {
  const value = transcriptDoc.value?.currentVersion?.content || ''
  if (!value) return 'No transcript yet.'
  const trimmed = value.trim()
  if (isSegmentedTranscript(trimmed)) {
    return segmentsToPlainText(parseTranscriptSegments(trimmed), { includeDisabled: false }) || 'No transcript yet.'
  }
  return trimmed
})

const summaryPreview = computed(() => {
  const value = summaryDoc.value?.currentVersion?.content || ''
  if (!value) return 'No summary yet.'
  const trimmed = value.trim()
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed
})

const summaryHighlights = computed(() => {
  const meta = summaryJob.value?.meta as Record<string, unknown> | undefined
  const summaryContent = (meta?.summaryContent || {}) as Record<string, unknown>
  const keyMoments = summaryContent.keyMoments
  if (Array.isArray(keyMoments)) {
    return keyMoments.filter(Boolean)
  }
  const highlights = summaryContent.highlights
  return Array.isArray(highlights) ? highlights.filter(Boolean) : []
})

const summaryPendingText = computed(() => {
  const meta = summaryJob.value?.meta as Record<string, unknown> | undefined
  const summaryContent = (meta?.summaryContent || {}) as Record<string, unknown>
  if (typeof summaryContent === 'string') return summaryContent
  if (typeof summaryContent.fullSummary === 'string') return summaryContent.fullSummary
  return ''
})

const summarySessionTags = computed(() => {
  const meta = summaryJob.value?.meta as Record<string, unknown> | undefined
  const summaryContent = (meta?.summaryContent || {}) as Record<string, unknown>
  return Array.isArray(summaryContent.sessionTags)
    ? summaryContent.sessionTags.filter(Boolean)
    : []
})

const summaryNotableDialogue = computed(() => {
  const meta = summaryJob.value?.meta as Record<string, unknown> | undefined
  const summaryContent = (meta?.summaryContent || {}) as Record<string, unknown>
  return Array.isArray(summaryContent.notableDialogue)
    ? summaryContent.notableDialogue.filter(Boolean)
    : []
})

const summaryConcreteFacts = computed(() => {
  const meta = summaryJob.value?.meta as Record<string, unknown> | undefined
  const summaryContent = (meta?.summaryContent || {}) as Record<string, unknown>
  return Array.isArray(summaryContent.concreteFacts)
    ? summaryContent.concreteFacts.filter(Boolean)
    : []
})

const summaryStatusLabel = computed(() => {
  switch (summaryJob.value?.status) {
    case 'READY_FOR_REVIEW':
      return 'Ready for review'
    case 'PROCESSING':
      return 'Processing'
    case 'SENT':
      return 'Sent'
    case 'APPLIED':
      return 'Applied'
    case 'FAILED':
      return 'Failed'
    case 'QUEUED':
      return 'Queued'
    default:
      return 'Not started'
  }
})

const summaryStatusColor = computed(() => {
  switch (summaryJob.value?.status) {
    case 'READY_FOR_REVIEW':
      return 'warning'
    case 'PROCESSING':
    case 'SENT':
    case 'QUEUED':
      return 'primary'
    case 'APPLIED':
      return 'success'
    case 'FAILED':
      return 'error'
    default:
      return 'secondary'
  }
})

const summarySuggestionGroups = computed(() => {
  const groups: Record<string, SummarySuggestion[]> = {}
  for (const suggestion of summarySuggestions.value) {
    const key = suggestion.entityType
    if (!groups[key]) groups[key] = []
    groups[key].push(suggestion)
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
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

const workflowItems = computed<TimelineItem[]>(() => [
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
    description: hasTranscript.value ? 'Review & edit transcript' : 'Await transcript',
    value: 'transcription',
    icon: hasTranscript.value ? 'i-lucide-file-text' : 'i-lucide-wand-2',
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
        guestDungeonMasterName: form.guestDungeonMasterName || null,
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
  const cachedUrl = playbackUrls[recordingId]
  if (cachedUrl) {
    const recording = recordings.value?.find((item) => item.id === recordingId)
    if (recording) {
      await player.playSource(
        {
          id: recordingId,
          title: recording.filename,
          subtitle: recording.kind,
          kind: recording.kind,
          src: cachedUrl,
        },
        { presentation: 'global' }
      )
    }
    return
  }
  if (playbackLoading[recordingId]) return
  playbackError.value = ''
  playbackLoading[recordingId] = true
  try {
    const payload = await request<{ url: string }>(
      `/api/recordings/${recordingId}/playback-url`
    )
    playbackUrls[recordingId] = payload.url
    const recording = recordings.value?.find((item) => item.id === recordingId)
    if (recording) {
      await player.playSource(
        {
          id: recordingId,
          title: recording.filename,
          subtitle: recording.kind,
          kind: recording.kind,
          src: payload.url,
        },
        { presentation: 'global' }
      )
    }
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
  if (!recap.value) return
  if (recapPlaybackUrl.value) {
    await player.playSource(
      {
        id: recap.value.id,
        title: recap.value.filename || 'Recap',
        subtitle: 'Recap audio',
        kind: 'AUDIO',
        src: recapPlaybackUrl.value,
      },
      { presentation: 'global' }
    )
    return
  }
  if (recapPlaybackLoading.value) return
  recapPlaybackLoading.value = true
  try {
    const payload = await request<{ url: string }>(`/api/recaps/${recap.value.id}/playback-url`)
    recapPlaybackUrl.value = payload.url
    await player.playSource(
      {
        id: recap.value.id,
        title: recap.value.filename || 'Recap',
        subtitle: 'Recap audio',
        kind: 'AUDIO',
        src: payload.url,
      },
      { presentation: 'global' }
    )
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
      format: type === 'TRANSCRIPT' ? 'PLAINTEXT' : 'MARKDOWN',
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
          format: 'PLAINTEXT',
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

const sendSummaryToN8n = async () => {
  if (!transcriptDoc.value) {
    summarySendError.value = 'Transcript is required to generate a summary.'
    return
  }
  summarySendError.value = ''
  summarySending.value = true
  try {
    await request(`/api/documents/${transcriptDoc.value.id}/summarize`, {
      method: 'POST',
      body: {
        mode: 'async',
      },
    })
    await refreshSummaryJob()
    await refreshSummary()
  } catch (error) {
    summarySendError.value =
      (error as Error & { message?: string }).message || 'Unable to send summary to n8n.'
  } finally {
    summarySending.value = false
  }
}

const applySummarySuggestion = async (suggestionId: string) => {
  summaryActionError.value = ''
  try {
    await request(`/api/summary-suggestions/${suggestionId}/apply`, {
      method: 'POST',
    })
    await refreshSummaryJob()
    await refreshSelectedSummaryJob()
  } catch (error) {
    summaryActionError.value =
      (error as Error & { message?: string }).message || 'Unable to apply suggestion.'
  }
}

const discardSummarySuggestion = async (suggestionId: string) => {
  summaryActionError.value = ''
  try {
    await request(`/api/summary-suggestions/${suggestionId}/discard`, {
      method: 'POST',
    })
    await refreshSummaryJob()
    await refreshSelectedSummaryJob()
  } catch (error) {
    summaryActionError.value =
      (error as Error & { message?: string }).message || 'Unable to discard suggestion.'
  }
}

const suggestionTitle = (suggestion: SummarySuggestion) => {
  const payload = suggestion.payload || {}
  if (typeof payload.title === 'string' && payload.title) return payload.title
  if (typeof payload.name === 'string' && payload.name) return payload.name
  return 'Untitled suggestion'
}

const applyPendingSummary = async () => {
  if (!summaryJob.value?.id) return
  summaryActionError.value = ''
  try {
    await request(`/api/summary-jobs/${summaryJob.value.id}/apply-summary`, {
      method: 'POST',
    })
    await refreshSummary()
    await refreshSummaryJob()
    await refreshSelectedSummaryJob()
  } catch (error) {
    summaryActionError.value =
      (error as Error & { message?: string }).message || 'Unable to apply summary.'
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
  <div class="space-y-8 theme-reveal">
    <div v-if="pending" class="grid gap-4">
      <UCard class="h-28 animate-pulse" />
      <UCard class="h-40 animate-pulse" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load this session.</p>
      <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
    </UCard>

    <div v-else class="space-y-6">
      <UPage>
        <template #left>
          <div class="space-y-4 lg:sticky lg:top-[calc(var(--ui-header-height)+1rem)]">
          <UCard class="sticky top-24 z-20 h-fit">
            <template #header>
              <div class="font-display text-lg tracking-[0.2em] uppercase text-secondary">
                Navigation
              </div>
            </template>
            <div class="flex flex-col gap-2">
              <UButton
                class="flex items-center justify-between rounded-2xl px-4 py-3"
                size="sm"
                variant="outline"
                :to="`/campaigns/${campaignId}`">
                <span>Back to campaign</span>
                <UIcon name="i-heroicons-chevron-left" class="h-4 w-4 text-[color:var(--theme-accent)]" />
              </UButton>
              <UButton
                class="flex items-center justify-between rounded-2xl px-4 py-3"
                size="sm"
                variant="outline"
                :to="`/campaigns/${campaignId}/sessions`">
                <span>Back to sessions</span>
                <UIcon name="i-heroicons-chevron-left" class="h-4 w-4 text-[color:var(--theme-accent)]" />
              </UButton>
              <USwitch
                :default-value="mode == 'workflow'"
                class="mt-4"
                indicator="end"
                variant="card"
                color="primary"
                label="Workflow Mode"
                @update:modelValue="(v) => v ? setMode('workflow') : setMode('overview')" />
            </div>
          </UCard>
            <UCard>
                <div class="mb-4 font-display text-sm tracking-[0.4em] uppercase text-[color:var(--theme-accent)]">
                  Now playing
                </div>
                <div class="space-y-3">
                  <div v-if="activePlayback" class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold">{{ activePlayback.title }}</p>
                      <p v-if="activePlayback.subtitle" class="text-xs text-muted">
                        {{ activePlayback.subtitle }}
                      </p>
                    </div>
                    <UButton size="xs" variant="ghost" @click="player.openDrawer">
                      Open player
                    </UButton>
                  </div>
                  <p v-else class="text-sm text-muted">Start playback to pin it here.</p>
                </div>
            </UCard>
            <UCard v-if="mode == 'workflow'" class="sticky top-24 z-10 h-fit">
              <div class="mb-4 font-display text-sm tracking-[0.4em] uppercase text-[color:var(--theme-accent)]">
                Workflow steps
              </div>
              <UTimeline
                v-model="activeStep"
                :items="workflowItems"
                orientation="vertical"
                class="w-full"
                @select="(_e, item: TimelineItem) => { activeStep = item.value as string; stepTouched = true }"
              />
            </UCard>
          </div>
        </template>

        <div class="space-y-6">
          <UCard class="sticky top-24 z-10 h-fit">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-4">
                <div class="space-y-1">
                  <p class="text-xs uppercase tracking-[0.3em] text-dimmed">{{ session?.sessionNumber ? `Session ${session?.sessionNumber}` : 'Session'}}</p>
                  <h1 class="text-2xl font-semibold">{{ session?.title || 'Session' }}</h1>
                  <p class="text-sm text-muted">
                    Played at: {{ sessionDateLabel }}
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <UButton variant="outline" @click="isEditSessionOpen = true">
                    Edit session
                  </UButton>
                  <UButton v-if="mode === 'overview'" @click="setMode('workflow')">
                    Enter Workflow Mode
                  </UButton>
                </div>
              </div>
            </template>
          </UCard>

          <UCard class="sm:hidden">
            <div class="mb-4 font-display text-sm tracking-[0.4em] uppercase text-(--theme-accent)">
              Status
            </div>
            <div class="space-y-2 text-sm">
              <div class="flex items-center justify-between">
                <span>Recordings</span>
                <span class="font-semibold">{{ recordingsCount }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Transcript</span>
                <span class="font-semibold">{{ transcriptStatus }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Summary</span>
                <span class="font-semibold">{{ summaryStatus }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Recap</span>
                <span class="font-semibold">{{ recapStatus }}</span>
              </div>
            </div>
          </UCard>
          <div class="hidden gap-4 sm:grid md:grid-cols-2 xl:grid-cols-4">
            <UCard :ui="{ body: 'p-4' }">
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Recordings</p>
              <p class="mt-2 text-lg font-semibold">{{ recordingsCount }}</p>
              <p class="text-xs text-muted">
                {{ recordingsCount ? 'Media uploaded.' : 'Add media files.' }}
              </p>
            </UCard>
            <UCard :ui="{ body: 'p-4' }">
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Transcript</p>
              <p class="mt-2 text-lg font-semibold">{{ transcriptStatus }}</p>
              <p class="text-xs text-muted">
                {{ transcriptStatus === 'Available' ? 'Ready to review.' : 'Awaiting transcript.' }}
              </p>
            </UCard>
            <UCard :ui="{ body: 'p-4' }">
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Summary</p>
              <p class="mt-2 text-lg font-semibold">{{ summaryStatus }}</p>
              <p class="text-xs text-muted">
                {{ summaryStatus === 'Available' ? 'Capture key beats.' : 'Generate summary.' }}
              </p>
            </UCard>
            <UCard :ui="{ body: 'p-4' }">
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Recap</p>
              <p class="mt-2 text-lg font-semibold">{{ recapStatus }}</p>
              <p class="text-xs text-muted">
                {{ recapStatus === 'Attached' ? 'Ready to play.' : 'Upload recap.' }}
              </p>
            </UCard>
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
                  <div>
                    <h2 class="text-lg font-semibold">Transcript</h2>
                    <p class="text-sm text-muted">Latest transcript content.</p>
                  </div>
                </template>
                <div class="space-y-3">
                  <p class="whitespace-pre-line text-sm text-muted">{{ transcriptPreview }}</p>
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
                  <p class="whitespace-pre-line text-sm text-muted">{{ summaryPreview }}</p>
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
                    <div
                      v-if="playbackUrls[recording.id]"
                      class="mt-3 flex items-center justify-between gap-3 text-xs text-muted"
                    >
                      <span>Playing in the global player.</span>
                      <UButton size="xs" variant="ghost" @click="player.openDrawer">
                        Open player
                      </UButton>
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
                  <div class="flex items-center justify-between gap-3 text-xs text-muted">
                    <span>Recap is playing in the global player.</span>
                    <UButton size="xs" variant="ghost" @click="player.openDrawer">
                      Open player
                    </UButton>
                  </div>
                </UCard>
                <p v-if="recapError" class="text-sm text-error">{{ recapError }}</p>
              </div>
            </UCard>
          </div>

          <div v-else class="space-y-4">
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
                      <p class="mt-1 font-semibold">{{ form.sessionNumber || '-' }}</p>
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
                        <div
                          v-if="playbackUrls[recording.id]"
                          class="mt-3 flex items-center justify-between gap-3 text-xs text-muted"
                        >
                          <span>Playing in the global player.</span>
                          <UButton size="xs" variant="ghost" @click="player.openDrawer">
                            Open player
                          </UButton>
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
                          @click="saveTranscript"
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
                            v-model="transcriptFile"
                            accept=".txt,.md,.markdown,.vtt"
                            variant="button"
                            label="Select transcript file"
                            :preview="false"
                          />
                          <UButton
                            :loading="transcriptImporting"
                            variant="outline"
                            class="w-full justify-center"
                            @click="importTranscript"
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
                      :to="`/campaigns/${campaignId}/documents/${transcriptDoc.id}`"
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
                    @click="showFullTranscript = !showFullTranscript"
                  >
                    {{ showFullTranscript ? 'Hide full transcript' : 'Show full transcript' }}
                  </UButton>
                  <p
                    class="whitespace-pre-line text-sm text-muted"
                    :class="showFullTranscript ? 'max-h-96 overflow-y-auto' : ''"
                  >
                    {{ showFullTranscript ? fullTranscript : transcriptPreview }}
                  </p>
                  <div class="rounded-lg border border-dashed border-muted-200 p-4">
                    <div class="space-y-3">
                      <p class="text-sm font-semibold">Attach subtitles to a video</p>
                      <p class="text-sm text-muted">
                        Do this after a transcript has been added.
                      </p>
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
                      <p v-if="subtitleAttachError" class="text-sm text-error">
                        {{ subtitleAttachError }}
                      </p>
                    </div>
                  </div>
                </div>
              </UCard>
            </div>

            <div v-else-if="activeStep === 'summary'" class="space-y-4">
              <UCard>
                <template #header>
                  <div>
                    <h2 class="text-lg font-semibold">n8n summarization</h2>
                    <p class="text-sm text-muted">
                      Send the transcript to n8n and review suggestions.
                    </p>
                  </div>
                </template>
                <div class="space-y-4">
                  <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <USelect
                      v-model="selectedSummaryJobId"
                      :items="summaryJobOptions"
                      placeholder="Select summary job"
                    />
                    <UButton size="sm" variant="outline" @click="refreshSummaryJob">
                      Refresh jobs
                    </UButton>
                  </div>
                  <div class="flex flex-wrap items-center gap-3">
                    <UButton
                      :loading="summarySending"
                      :disabled="!transcriptDoc"
                      @click="sendSummaryToN8n"
                    >
                      Send transcript to n8n
                    </UButton>
                    <UBadge variant="soft" :color="summaryStatusColor" size="sm">
                      {{ summaryStatusLabel }}
                    </UBadge>
                    <span v-if="summaryJob?.trackingId" class="text-xs text-muted">
                      {{ summaryJob.trackingId }}
                    </span>
                  </div>
                  <div v-if="summaryPendingText" class="space-y-2">
                    <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Pending summary</p>
                    <p class="whitespace-pre-line text-sm text-muted">
                      {{ summaryPendingText }}
                    </p>
                    <UButton size="sm" variant="outline" @click="applyPendingSummary">
                      Apply summary
                    </UButton>
                  </div>
                  <p
                    v-if="summaryJob?.status === 'READY_FOR_REVIEW'"
                    class="text-sm text-muted"
                  >
                    Review the suggestions below and apply changes you want to keep.
                  </p>
                  <div v-if="summaryHighlights.length" class="space-y-2">
                    <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Key moments</p>
                    <ul class="list-disc space-y-1 pl-5 text-sm text-muted">
                      <li v-for="highlight in summaryHighlights" :key="highlight">{{ highlight }}</li>
                    </ul>
                  </div>
                  <div v-if="summarySessionTags.length" class="space-y-2">
                    <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Session tags</p>
                    <div class="flex flex-wrap gap-2">
                      <UBadge
                        v-for="tag in summarySessionTags"
                        :key="tag"
                        variant="soft"
                        color="secondary"
                        size="sm"
                      >
                        {{ tag }}
                      </UBadge>
                    </div>
                  </div>
                  <div v-if="summaryNotableDialogue.length" class="space-y-2">
                    <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Notable dialogue</p>
                    <ul class="list-disc space-y-1 pl-5 text-sm text-muted">
                      <li v-for="line in summaryNotableDialogue" :key="line">{{ line }}</li>
                    </ul>
                  </div>
                  <div v-if="summaryConcreteFacts.length" class="space-y-2">
                    <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Concrete facts</p>
                    <ul class="list-disc space-y-1 pl-5 text-sm text-muted">
                      <li v-for="fact in summaryConcreteFacts" :key="fact">{{ fact }}</li>
                    </ul>
                  </div>
                  <div v-if="summarySuggestionGroups.length" class="space-y-3">
                    <div
                      v-if="sessionSuggestion"
                      class="rounded-lg border border-default bg-elevated/20 p-4"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <p class="text-sm font-semibold">Session suggestion</p>
                        <UBadge variant="soft" color="primary" size="sm">
                          {{ sessionSuggestion.action }}
                        </UBadge>
                      </div>
                      <div class="mt-3 space-y-2 text-sm text-muted">
                        <div v-if="sessionSuggestion.payload.title">
                          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Title</p>
                          <p class="mt-1 font-semibold text-default">
                            {{ sessionSuggestion.payload.title }}
                          </p>
                        </div>
                        <div v-if="sessionSuggestion.payload.notes">
                          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Notes</p>
                          <p class="mt-1 whitespace-pre-line">
                            {{ sessionSuggestion.payload.notes }}
                          </p>
                        </div>
                      </div>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <UButton
                          size="xs"
                          variant="outline"
                          :disabled="sessionSuggestion.status !== 'PENDING'"
                          @click="applySummarySuggestion(sessionSuggestion.id)"
                        >
                          Apply
                        </UButton>
                        <UButton
                          size="xs"
                          variant="ghost"
                          color="gray"
                          :disabled="sessionSuggestion.status !== 'PENDING'"
                          @click="discardSummarySuggestion(sessionSuggestion.id)"
                        >
                          Discard
                        </UButton>
                      </div>
                    </div>
                    <div
                      v-for="group in summarySuggestionGroups"
                      :key="group.label"
                      class="rounded-lg border border-default bg-elevated/20 p-4"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <p class="text-sm font-semibold">{{ group.label }}</p>
                        <UBadge variant="soft" color="primary" size="sm">
                          {{ group.items.length }}
                        </UBadge>
                      </div>
                      <div class="mt-3 space-y-3">
                        <div
                          v-for="suggestion in group.items"
                          :key="suggestion.id"
                          class="rounded-md border border-default bg-background/60 p-3"
                        >
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p class="text-sm font-semibold">{{ suggestionTitle(suggestion) }}</p>
                              <p class="text-xs text-muted">
                                {{ suggestion.action }} · {{ suggestion.status }}
                              </p>
                            </div>
                            <div class="flex flex-wrap gap-2">
                              <UButton
                                size="xs"
                                variant="outline"
                                :disabled="suggestion.status !== 'PENDING'"
                                @click="applySummarySuggestion(suggestion.id)"
                              >
                                Apply
                              </UButton>
                              <UButton
                                size="xs"
                                variant="ghost"
                                color="gray"
                                :disabled="suggestion.status !== 'PENDING'"
                                @click="discardSummarySuggestion(suggestion.id)"
                              >
                                Discard
                              </UButton>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p v-if="summarySendError" class="text-sm text-error">{{ summarySendError }}</p>
                  <p v-if="summaryActionError" class="text-sm text-error">{{ summaryActionError }}</p>
                </div>
              </UCard>
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
                      <div class="flex items-center justify-between gap-3 text-xs text-muted">
                        <span>Recap is playing in the global player.</span>
                        <UButton size="xs" variant="ghost" @click="player.openDrawer">
                          Open player
                        </UButton>
                      </div>
                    </UCard>
                  <p v-if="recapError" class="text-sm text-error">{{ recapError }}</p>
                  <p v-if="recapDeleteError" class="text-sm text-error">{{ recapDeleteError }}</p>
                </div>
              </UCard>
            </div>
          </div>
        </div>
      </UPage>
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
              <UInput v-model="form.title" placeholder="This Is Why Taverns Have Rules" />
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
              <label class="mb-2 block text-sm text-muted">Guest dungeon master</label>
              <UInput v-model="form.guestDungeonMasterName" placeholder="Optional guest DM" />
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
