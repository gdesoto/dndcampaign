<script setup lang="ts">
import {
  parseTranscriptSegments,
  serializeTranscriptSegments,
  segmentsToPlainText,
  type TranscriptSegment,
} from '#shared/utils/transcript'

definePageMeta({ layout: 'app' })

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
  sessionId?: string | null
  recordingId?: string | null
  currentVersionId?: string | null
  currentVersion?: DocumentVersion | null
}

type SessionRecording = {
  id: string
  kind: 'AUDIO' | 'VIDEO'
  filename: string
  createdAt: string
  durationSeconds?: number | null
  vttArtifactId?: string | null
}

type HighlightPart = { text: string; match: boolean }

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const documentId = computed(() => route.params.documentId as string)
const { request } = useApi()
const player = useMediaPlayer()
const hasMounted = ref(false)
const playbackRangeError = ref('')
let playbackRangeTimer: ReturnType<typeof setInterval> | undefined
const showFullTranscript = ref(false)

const { data: document, pending, refresh, error } = await useAsyncData(
  () => `document-${documentId.value}`,
  () => request<DocumentDetail>(`/api/documents/${documentId.value}`)
)

const { data: versions, refresh: refreshVersions } = await useAsyncData(
  () => `document-versions-${documentId.value}`,
  () => request<DocumentVersion[]>(`/api/documents/${documentId.value}/versions`)
)

const content = ref('')
const segments = ref<TranscriptSegment[]>([])
const isDirty = ref(false)
const lastSavedAt = ref<string | null>(null)
const saveError = ref('')
const isSaving = ref(false)
const restoreError = ref('')
const importing = ref(false)
const importError = ref('')
const importFile = ref<File | null>(null)
const subtitleAttachLoading = ref(false)
const subtitleAttachError = ref('')
const selectedSubtitleRecordingId = ref('')

const windowStart = ref(0)
const windowSize = ref(200)
const searchInput = ref('')
const searchTerm = ref('')
const activeMatchIndex = ref(0)
const selectedSegmentId = ref('')
const selectedSegmentIds = ref<string[]>([])
let searchTimer: ReturnType<typeof setTimeout> | undefined
const searchFilterEnabled = ref(false)
const speakerFilterSelection = ref<string[]>([])
const startTimeFilter = ref('')
const endTimeFilter = ref('')
const minLengthFilter = ref('')
const maxLengthFilter = ref('')
const speakerBulkInput = ref('')

const { data: sessionRecordings } = await useAsyncData(
  () => `document-session-recordings-${documentId.value}`,
  async () => {
    if (!document.value?.sessionId) return []
    return request<SessionRecording[]>(
      `/api/sessions/${document.value.sessionId}/recordings`
    )
  },
  { watch: [document] }
)

const recordingOptions = computed(() =>
  (sessionRecordings.value || []).map((recording) => ({
    label: `${recording.filename} (${recording.kind})`,
    value: recording.id,
  }))
)

const linkedRecordingLabel = computed(() => {
  const id = linkedRecordingId.value
  if (!id) return ''
  const match = sessionRecordings.value?.find((recording) => recording.id === id)
  return match ? `${match.filename} (${match.kind})` : id
})

const selectedRecordingLabel = computed(() => {
  if (!selectedRecordingId.value) return 'None selected'
  const match = sessionRecordings.value?.find(
    (recording) => recording.id === selectedRecordingId.value
  )
  return match ? `${match.filename} (${match.kind})` : selectedRecordingId.value
})

const videoOptions = computed(() =>
  (sessionRecordings.value || [])
    .filter((recording) => recording.kind === 'VIDEO')
    .map((recording) => ({
      label: recording.filename,
      value: recording.id,
    }))
)

const selectedRecordingId = ref('')
const linkedRecordingId = computed(() => document.value?.recordingId || '')

const { data: selectedRecording } = await useAsyncData(
  () => `document-recording-${selectedRecordingId.value}`,
  async () => {
    if (!selectedRecordingId.value) return null
    return request<SessionRecording>(`/api/recordings/${selectedRecordingId.value}`)
  },
  { watch: [selectedRecordingId] }
)

const { data: playbackUrl, pending: playbackPending } = await useAsyncData(
  () => `document-recording-playback-${selectedRecordingId.value}`,
  async () => {
    if (!selectedRecordingId.value) return ''
    const payload = await request<{ url: string }>(
      `/api/recordings/${selectedRecordingId.value}/playback-url`
    )
    return payload.url
  },
  { watch: [selectedRecordingId] }
)

onMounted(() => {
  hasMounted.value = true
})

onBeforeUnmount(() => {
  if (playbackRangeTimer) {
    clearInterval(playbackRangeTimer)
  }
})

onBeforeUnmount(() => {
  if (playbackRangeTimer) {
    clearInterval(playbackRangeTimer)
  }
})

const vttUrl = computed(() =>
  selectedRecording.value?.vttArtifactId
    ? `/api/artifacts/${selectedRecording.value.vttArtifactId}/stream`
    : undefined
)

const playbackReady = computed(() =>
  hasMounted.value ? Boolean(playbackUrl.value) : false
)

watch(
  () => document.value,
  (value) => {
    const nextContent = value?.currentVersion?.content || ''
    content.value = nextContent
    if (value?.type === 'TRANSCRIPT') {
      segments.value = parseTranscriptSegments(nextContent)
      isDirty.value = false
      lastSavedAt.value = value?.currentVersion?.createdAt || null
      windowStart.value = 0
      selectedSegmentId.value = ''
      selectedSegmentIds.value = []
      activeMatchIndex.value = 0
    } else {
      segments.value = []
    }
  },
  { immediate: true }
)

watch(
  () => [videoOptions.value, recordingOptions.value],
  ([videoList, recordingList]) => {
    if (videoList.length && !selectedSubtitleRecordingId.value) {
      selectedSubtitleRecordingId.value = videoList[0].value
    }
    if (recordingList.length && !selectedRecordingId.value) {
      if (linkedRecordingId.value) {
        selectedRecordingId.value = linkedRecordingId.value
        return
      }
      const preferred =
        sessionRecordings.value?.find((item) => item.kind === 'AUDIO') ||
        sessionRecordings.value?.[0]
      selectedRecordingId.value = preferred?.id || ''
    }
  },
  { immediate: true }
)

watch(
  () => searchInput.value,
  (value) => {
    const nextValue = String(value ?? '').trim()
    if (!nextValue) {
      if (searchTimer) {
        clearTimeout(searchTimer)
      }
      searchTerm.value = ''
      activeMatchIndex.value = 0
      return
    }
    if (searchTimer) {
      clearTimeout(searchTimer)
    }
    searchTimer = setTimeout(() => {
      searchTerm.value = nextValue
      activeMatchIndex.value = 0
    }, 200)
  }
)

const parseTimeInput = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parts = trimmed.split(':').map((part) => Number(part))
  if (parts.some((part) => Number.isNaN(part))) return null
  if (parts.length === 1) return parts[0] * 1000
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
  return null
}

const speakerFilters = computed(() =>
  speakerFilterSelection.value.map((item) => item.toLowerCase())
)

const speakerOptions = computed(() => {
  const unique = new Set<string>()
  segments.value.forEach((segment) => {
    const speaker = (segment.speaker || '').trim()
    if (speaker) unique.add(speaker)
  })
  return Array.from(unique).sort((a, b) => a.localeCompare(b))
})

const startFilterMs = computed(() => parseTimeInput(startTimeFilter.value))
const endFilterMs = computed(() => parseTimeInput(endTimeFilter.value))
const minLengthMs = computed(() => {
  const raw = minLengthFilter.value.trim()
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value * 1000 : null
})
const maxLengthMs = computed(() => {
  const raw = maxLengthFilter.value.trim()
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value * 1000 : null
})

const baseFilteredSegments = computed(() => {
  const speakerList = speakerFilters.value
  const startMs = startFilterMs.value
  const endMs = endFilterMs.value
  const minLen = minLengthMs.value
  const maxLen = maxLengthMs.value
  return segments.value.filter((segment) => {
    if (speakerList.length) {
      const speaker = (segment.speaker || '').toLowerCase()
      if (!speaker || !speakerList.includes(speaker)) return false
    }
    if (startMs !== null || endMs !== null) {
      if (segment.startMs === null || segment.endMs === null) return false
      if (startMs !== null && segment.endMs < startMs) return false
      if (endMs !== null && segment.startMs > endMs) return false
    }
    if (minLen !== null || maxLen !== null) {
      if (segment.startMs === null || segment.endMs === null) return false
      const duration = segment.endMs - segment.startMs
      if (minLen !== null && duration < minLen) return false
      if (maxLen !== null && duration > maxLen) return false
    }
    return true
  })
})

const filteredSegments = computed(() => {
  if (!searchFilterEnabled.value || !searchTerm.value) return baseFilteredSegments.value
  const needle = searchTerm.value.toLowerCase()
  return baseFilteredSegments.value.filter((segment) =>
    segment.text.toLowerCase().includes(needle)
  )
})

const matchIndices = computed(() => {
  if (!searchTerm.value) return []
  const needle = searchTerm.value.toLowerCase()
  const matches: number[] = []
  filteredSegments.value.forEach((segment, index) => {
    if (segment.text.toLowerCase().includes(needle)) {
      matches.push(index)
    }
  })
  return matches
})

const visibleSegments = computed(() =>
  filteredSegments.value.slice(windowStart.value, windowStart.value + windowSize.value)
)

const canPrevWindow = computed(() => windowStart.value > 0)
const canNextWindow = computed(
  () => windowStart.value + windowSize.value < filteredSegments.value.length
)

const windowLabel = computed(() => {
  if (!filteredSegments.value.length) return '0 segments'
  const start = windowStart.value + 1
  const end = Math.min(windowStart.value + windowSize.value, filteredSegments.value.length)
  return `${start}-${end} of ${filteredSegments.value.length}`
})

const currentTimeMs = computed(() => player.state.value.currentTime * 1000)
const activeSegmentId = computed(() => {
  if (!currentTimeMs.value) return ''
  const match = visibleSegments.value.find(
    (segment) =>
      typeof segment.startMs === 'number' &&
      typeof segment.endMs === 'number' &&
      currentTimeMs.value >= segment.startMs &&
      currentTimeMs.value <= segment.endMs
  )
  return match?.id || ''
})

const formatTimestamp = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '--:--'
  const totalSeconds = Math.floor(value / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatDuration = (segment: TranscriptSegment) => {
  if (segment.startMs === null || segment.endMs === null) return ''
  const duration = Math.max(0, segment.endMs - segment.startMs)
  return `${(duration / 1000).toFixed(1)}s`
}

const highlightParts = (text: string): HighlightPart[] => {
  const needle = searchTerm.value.toLowerCase()
  if (!needle) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const parts: HighlightPart[] = []
  let index = 0
  while (index < text.length) {
    const matchIndex = lower.indexOf(needle, index)
    if (matchIndex === -1) {
      parts.push({ text: text.slice(index), match: false })
      break
    }
    if (matchIndex > index) {
      parts.push({ text: text.slice(index, matchIndex), match: false })
    }
    parts.push({
      text: text.slice(matchIndex, matchIndex + needle.length),
      match: true,
    })
    index = matchIndex + needle.length
  }
  return parts
}

const markDirty = () => {
  if (!isDirty.value) {
    isDirty.value = true
  }
}

const toggleSegmentDisabled = (segment: TranscriptSegment) => {
  segment.disabled = !segment.disabled
  markDirty()
}

const selectedSet = computed(() => new Set(selectedSegmentIds.value))

const toggleSegmentSelection = (segmentId: string) => {
  const next = new Set(selectedSegmentIds.value)
  if (next.has(segmentId)) {
    next.delete(segmentId)
  } else {
    next.add(segmentId)
  }
  selectedSegmentIds.value = Array.from(next)
}

const selectAllFiltered = () => {
  selectedSegmentIds.value = filteredSegments.value.map((segment) => segment.id)
}

const clearSelection = () => {
  selectedSegmentIds.value = []
}

const applyDisableToSelection = (disabled: boolean) => {
  const selection = selectedSet.value
  if (!selection.size) return
  segments.value.forEach((segment) => {
    if (selection.has(segment.id)) {
      segment.disabled = disabled
    }
  })
  markDirty()
}

const applySpeakerToSelection = (speakerValue: string) => {
  const trimmed = speakerValue.trim()
  if (!trimmed) return
  const selection = selectedSet.value
  if (!selection.size) return
  segments.value.forEach((segment) => {
    if (selection.has(segment.id)) {
      segment.speaker = trimmed
    }
  })
  markDirty()
}

const applySpeakerToFiltered = (speakerValue: string) => {
  const trimmed = speakerValue.trim()
  if (!trimmed) return
  const filteredIds = new Set(filteredSegments.value.map((segment) => segment.id))
  segments.value.forEach((segment) => {
    if (filteredIds.has(segment.id)) {
      segment.speaker = trimmed
    }
  })
  markDirty()
}

const jumpToSegment = async (segment: TranscriptSegment) => {
  if (segment.startMs === null || segment.startMs === undefined) return
  player.seek(segment.startMs / 1000)
}

const goToMatch = (direction: 1 | -1) => {
  if (!matchIndices.value.length) return
  const nextIndex =
    (activeMatchIndex.value + direction + matchIndices.value.length) %
    matchIndices.value.length
  activeMatchIndex.value = nextIndex
  const segmentIndex = matchIndices.value[nextIndex]
  if (typeof segmentIndex !== 'number') return
  selectedSegmentId.value = filteredSegments.value[segmentIndex]?.id || ''
  const nextWindowStart = Math.max(0, segmentIndex - Math.floor(windowSize.value / 2))
  windowStart.value = nextWindowStart
  nextTick(() => {
    const el = globalThis.document?.querySelector(
      `#segment-${selectedSegmentId.value}`
    )
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

const moveWindow = (direction: 1 | -1) => {
  const nextStart = Math.max(
    0,
    Math.min(
      windowStart.value + direction * windowSize.value,
      Math.max(0, filteredSegments.value.length - windowSize.value)
    )
  )
  windowStart.value = nextStart
}

const saveDocument = async () => {
  saveError.value = ''
  isSaving.value = true
  try {
    const isTranscript = document.value?.type === 'TRANSCRIPT'
    const payloadContent = isTranscript
      ? serializeTranscriptSegments(segments.value)
      : content.value
    const format = isTranscript ? 'PLAINTEXT' : 'MARKDOWN'

    await request(`/api/documents/${documentId.value}`, {
      method: 'PATCH',
      body: {
        content: payloadContent,
        format,
      },
    })
    isDirty.value = false
    lastSavedAt.value = new Date().toISOString()
    await refresh()
    await refreshVersions()
  } catch (error) {
    saveError.value =
      (error as Error & { message?: string }).message || 'Unable to save document.'
  } finally {
    isSaving.value = false
  }
}

const restoreVersion = async (versionId: string) => {
  restoreError.value = ''
  try {
    await request(`/api/documents/${documentId.value}/restore`, {
      method: 'POST',
      body: { versionId },
    })
    await refresh()
    await refreshVersions()
  } catch (error) {
    restoreError.value =
      (error as Error & { message?: string }).message || 'Unable to restore version.'
  }
}

const importDocument = async () => {
  if (!importFile.value || !document.value?.sessionId) return
  importError.value = ''
  importing.value = true
  try {
    const formData = new FormData()
    formData.append('file', importFile.value)
    formData.append('type', document.value.type)
    await request(`/api/sessions/${document.value.sessionId}/documents/import`, {
      method: 'POST',
      body: formData,
    })
    importFile.value = null
    await refresh()
    await refreshVersions()
  } catch (error) {
    importError.value =
      (error as Error & { message?: string }).message || 'Import failed.'
  } finally {
    importing.value = false
  }
}

const attachTranscriptToVideo = async () => {
  if (!selectedSubtitleRecordingId.value || document.value?.type !== 'TRANSCRIPT') return
  subtitleAttachError.value = ''
  subtitleAttachLoading.value = true
  try {
    await request(`/api/recordings/${selectedSubtitleRecordingId.value}/vtt/from-transcript`, {
      method: 'POST',
    })
  } catch (error) {
    subtitleAttachError.value =
      (error as Error & { message?: string }).message || 'Unable to attach subtitles.'
  } finally {
    subtitleAttachLoading.value = false
  }
}

const startPlayback = async () => {
  if (!selectedRecording.value || !playbackUrl.value) return
  await player.playSource(
    {
      id: selectedRecording.value.id,
      title: selectedRecording.value.filename,
      subtitle: selectedRecording.value.kind,
      kind: selectedRecording.value.kind,
      src: playbackUrl.value,
      vttUrl: vttUrl.value,
    },
    { presentation: 'page' }
  )
}

const stopPlaybackRangeTimer = () => {
  if (playbackRangeTimer) {
    clearInterval(playbackRangeTimer)
    playbackRangeTimer = undefined
  }
}

const playRange = async (startMs: number, endMs: number) => {
  playbackRangeError.value = ''
  if (!selectedRecording.value || !playbackUrl.value) {
    playbackRangeError.value = 'Select a recording to play this segment.'
    return
  }
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    playbackRangeError.value = 'Segment time range is invalid.'
    return
  }

  await startPlayback()
  player.seek(startMs / 1000)
  await player.play()

  stopPlaybackRangeTimer()
  const endSeconds = endMs / 1000
  playbackRangeTimer = setInterval(() => {
    const current = player.state.value.currentTime
    if (current >= endSeconds) {
      player.pause()
      stopPlaybackRangeTimer()
    }
  }, 150)
}

const playSegment = async (segment: TranscriptSegment) => {
  if (segment.startMs === null || segment.endMs === null) {
    playbackRangeError.value = 'This segment has no timestamps.'
    return
  }
  let startMs = segment.startMs
  let endMs = segment.endMs
  const duration = endMs - startMs
  if (duration < 1000) {
    const pad = (1000 - duration) / 2
    startMs = Math.max(0, startMs - pad)
    endMs = endMs + pad
  }
  await playRange(startMs, endMs)
}

const playSelection = async () => {
  const selection = selectedSet.value
  if (!selection.size) {
    playbackRangeError.value = 'Select at least one segment.'
    return
  }
  const selectedSegments = segments.value.filter((segment) =>
    selection.has(segment.id)
  )
  const timed = selectedSegments.filter(
    (segment) =>
      typeof segment.startMs === 'number' && typeof segment.endMs === 'number'
  )
  if (!timed.length) {
    playbackRangeError.value = 'Selected segments have no timestamps.'
    return
  }
  let startMs = Math.min(...timed.map((segment) => segment.startMs as number))
  let endMs = Math.max(...timed.map((segment) => segment.endMs as number))
  const duration = endMs - startMs
  if (duration < 1000) {
    const pad = (1000 - duration) / 2
    startMs = Math.max(0, startMs - pad)
    endMs = endMs + pad
  }
  await playRange(startMs, endMs)
}

const linkRecordingToTranscript = async () => {
  if (!document.value?.id) return
  if (!selectedRecordingId.value) {
    playbackRangeError.value = 'Select a recording to link.'
    return
  }
  playbackRangeError.value = ''
  try {
    await request(`/api/documents/${document.value.id}/link-recording`, {
      method: 'POST',
      body: { recordingId: selectedRecordingId.value },
    })
    await refresh()
  } catch (error) {
    playbackRangeError.value =
      (error as Error & { message?: string }).message || 'Unable to link recording.'
  }
}

const unlinkRecording = async () => {
  if (!document.value?.id) return
  playbackRangeError.value = ''
  try {
    await request(`/api/documents/${document.value.id}/link-recording`, {
      method: 'POST',
      body: { recordingId: null },
    })
    await refresh()
  } catch (error) {
    playbackRangeError.value =
      (error as Error & { message?: string }).message || 'Unable to unlink recording.'
  }
}

const transcriptPreview = computed(() => {
  if (document.value?.type !== 'TRANSCRIPT') return ''
  if (!segments.value.length) return 'No segments yet.'
  return segmentsToPlainText(segments.value.slice(0, 3), { includeDisabled: false })
})

const fullTranscript = computed(() =>
  segmentsToPlainText(segments.value, { includeDisabled: false })
)
</script>

<template>
  <UPage>
    <div class="space-y-8">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-dimmed">
            Document
          </p>
          <h1 class="mt-2 text-2xl font-semibold">
            {{ document?.title || 'Document editor' }}
          </h1>
        </div>
        <div class="flex flex-wrap gap-3">
          <UButton
            v-if="document?.sessionId"
            variant="outline"
            :to="`/campaigns/${campaignId}/sessions/${document.sessionId}`"
          >
            Back to session
          </UButton>
          <UButton variant="outline" :to="`/campaigns/${campaignId}/sessions`">
            All sessions
          </UButton>
        </div>
      </div>

      <div v-if="pending" class="grid gap-4">
        <UCard class="h-32 animate-pulse" />
        <UCard class="h-52 animate-pulse" />
      </div>

      <UCard v-else-if="error" class="text-center">
        <p class="text-sm text-error">Unable to load this document.</p>
        <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
      </UCard>

      <div
        v-else-if="document?.type === 'TRANSCRIPT'"
        class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
      >
        <UCard>
          <template #header>
            <div class="space-y-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 class="text-lg font-semibold">Transcript editor</h2>
                  <p class="text-sm text-muted">
                    Segmented editing with audio sync and search.
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2 text-xs text-dimmed">
                  <span v-if="isDirty" class="rounded-full bg-warning/20 px-2 py-1 text-warning">
                    Unsaved changes
                  </span>
                  <span v-if="lastSavedAt">
                    Last saved {{ new Date(lastSavedAt).toLocaleString() }}
                  </span>
                  <UButton :loading="isSaving" size="sm" @click="saveDocument">
                    Save version
                  </UButton>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <UInput
                  v-model="searchInput"
                  size="sm"
                  class="min-w-[220px]"
                  placeholder="Search transcript"
                />
                <UCheckbox v-model="searchFilterEnabled" label="Filter matches" />
                <div class="flex items-center gap-2 text-xs text-dimmed">
                  <UButton
                    size="xs"
                    variant="outline"
                    :disabled="!matchIndices.length"
                    @click="goToMatch(-1)"
                  >
                    Prev
                  </UButton>
                  <UButton
                    size="xs"
                    variant="outline"
                    :disabled="!matchIndices.length"
                    @click="goToMatch(1)"
                  >
                    Next
                  </UButton>
                  <span v-if="matchIndices.length">
                    {{ activeMatchIndex + 1 }}/{{ matchIndices.length }} matches
                  </span>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-3 text-xs text-dimmed">
                <UInputMenu
                  v-model="speakerFilterSelection"
                  size="xs"
                  class="min-w-[200px]"
                  multiple
                  :items="speakerOptions"
                  placeholder="Filter speakers"
                />
                <UInput
                  v-model="startTimeFilter"
                  size="xs"
                  class="w-28"
                  placeholder="Start mm:ss"
                />
                <UInput
                  v-model="endTimeFilter"
                  size="xs"
                  class="w-28"
                  placeholder="End mm:ss"
                />
                <UInput
                  v-model="minLengthFilter"
                  size="xs"
                  class="w-24"
                  placeholder="Min s"
                />
                <UInput
                  v-model="maxLengthFilter"
                  size="xs"
                  class="w-24"
                  placeholder="Max s"
                />
                <div class="flex flex-wrap items-center gap-2">
                  <UInput
                    v-model="speakerBulkInput"
                    size="xs"
                    class="min-w-[150px]"
                    placeholder="Set speaker"
                  />
                  <UButton
                    size="xs"
                    variant="outline"
                    :disabled="!selectedSegmentIds.length"
                    @click="applySpeakerToSelection(speakerBulkInput)"
                  >
                    Apply to selection
                  </UButton>
                  <UButton
                    size="xs"
                    variant="outline"
                    :disabled="!filteredSegments.length"
                    @click="applySpeakerToFiltered(speakerBulkInput)"
                  >
                    Apply to filtered
                  </UButton>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2 text-xs text-dimmed">
                <UButton size="xs" variant="ghost" @click="selectAllFiltered">
                  Select filtered
                </UButton>
                <UButton size="xs" variant="ghost" @click="clearSelection">
                  Clear selection
                </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  :disabled="!selectedSegmentIds.length"
                  @click="applyDisableToSelection(true)"
                >
                  Disable selection
                </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  :disabled="!selectedSegmentIds.length"
                  @click="applyDisableToSelection(false)"
                >
                  Enable selection
                </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  :disabled="!selectedSegmentIds.length"
                  @click="playSelection"
                >
                  Play selection
                </UButton>
              </div>
              <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-dimmed">
                <span>Showing {{ windowLabel }}</span>
                <div class="flex items-center gap-2">
                  <UButton
                    size="xs"
                    variant="ghost"
                    :disabled="!canPrevWindow"
                    @click="moveWindow(-1)"
                  >
                    Previous window
                  </UButton>
                  <UButton
                    size="xs"
                    variant="ghost"
                    :disabled="!canNextWindow"
                    @click="moveWindow(1)"
                  >
                    Next window
                  </UButton>
                </div>
              </div>
              <p v-if="saveError" class="text-sm text-error">{{ saveError }}</p>
            </div>
          </template>

          <div class="space-y-4">
            <p v-if="!segments.length" class="text-sm text-muted">
              No segments yet. Import a transcript or start a transcription job.
            </p>

            <div v-else class="space-y-3">
              <div
                v-for="(segment, idx) in visibleSegments"
                :id="`segment-${segment.id}`"
                :key="segment.id"
                class="rounded-lg border border-default bg-elevated/30 p-3"
                :class="{
                  'border-primary/60 bg-primary/10': segment.id === activeSegmentId,
                  'border-warning/50': matchIndices.includes(windowStart + idx),
                  'opacity-60': segment.disabled,
                }"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2 text-xs text-dimmed">
                    <span>{{ formatTimestamp(segment.startMs) }}</span>
                    <span v-if="segment.endMs !== null">- {{ formatTimestamp(segment.endMs) }}</span>
                    <span v-if="formatDuration(segment)">
                      - {{ formatDuration(segment) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <UCheckbox
                      :model-value="selectedSet.has(segment.id)"
                      @update:modelValue="() => toggleSegmentSelection(segment.id)"
                    />
                    <UButton
                      size="xs"
                      variant="ghost"
                      @click="toggleSegmentDisabled(segment)"
                    >
                      {{ segment.disabled ? 'Enable' : 'Disable' }}
                    </UButton>
                    <UButton
                      size="xs"
                      variant="ghost"
                      :disabled="segment.startMs === null || segment.endMs === null"
                      @click="playSegment(segment)"
                    >
                      Play segment
                    </UButton>
                    <UButton
                      size="xs"
                      variant="ghost"
                      :disabled="segment.startMs === null"
                      @click="jumpToSegment(segment)"
                    >
                      Jump
                    </UButton>
                  </div>
                </div>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <UInput
                    v-model="segment.speaker"
                    size="xs"
                    class="w-36"
                    placeholder="Speaker"
                    @input="markDirty"
                  />
                  <span v-if="segment.disabled" class="rounded-full bg-warning/20 px-2 py-0.5 text-warning">
                    Disabled in preview
                  </span>
                  <span v-if="segment.confidence !== null" class="text-dimmed">
                    Confidence: {{ Math.round(segment.confidence * 100) }}%
                  </span>
                </div>
                <div v-if="searchTerm" class="mt-2 text-xs text-muted">
                  <span v-for="(part, partIndex) in highlightParts(segment.text)" :key="partIndex">
                    <span v-if="part.match" class="rounded bg-warning/30 px-1">
                      {{ part.text }}
                    </span>
                    <span v-else>{{ part.text }}</span>
                  </span>
                </div>
                <UTextarea
                  v-model="segment.text"
                  :rows="2"
                  size="sm"
                  class="mt-2"
                  @input="markDirty"
                />
              </div>
            </div>
          </div>
        </UCard>

        <div class="space-y-6">
            <UCard class="sticky top-24 z-20">
            <template #header>
              <div>
                <h2 class="text-lg font-semibold">Playback</h2>
                <p class="text-sm text-muted">
                  Sync transcript edits with session audio or video.
                </p>
              </div>
            </template>
            <div class="space-y-3">
              <div class="flex items-center gap-2 text-xs text-dimmed">
                <span>Selected audio file:</span>
                <span class="font-semibold text-default">{{ selectedRecordingLabel }}</span>
                <UTooltip text="Change the linked audio in Transcript actions.">
                  <UIcon name="i-lucide-info" class="h-4 w-4 text-dimmed" />
                </UTooltip>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <UButton
                  size="sm"
                  variant="outline"
                  :disabled="!playbackReady"
                  :loading="hasMounted && playbackPending"
                  @click="startPlayback"
                >
                  Play in editor
                </UButton>
                <span v-if="hasMounted && playbackPending" class="text-xs text-dimmed">
                  Loading stream...
                </span>
              </div>
              <MediaPlayerDock dock-id="transcript-player-dock" mode="page" />
              <p v-if="player.state.error" class="text-sm text-error">
                {{ player.state.error }}
              </p>
              <p v-if="playbackRangeError" class="text-sm text-error">
                {{ playbackRangeError }}
              </p>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div>
                <h2 class="text-lg font-semibold">Transcript actions</h2>
                <p class="text-sm text-muted">
                  Import text or attach subtitles to video recordings.
                </p>
              </div>
            </template>
            <div class="space-y-4">
              <div class="grid gap-3">
                <UInput
                  type="file"
                  accept=".txt,.md,.markdown,.vtt"
                  @change="importFile = ($event.target as HTMLInputElement).files?.[0] || null"
                />
                <UButton
                  class="w-full justify-center"
                  :disabled="!document?.sessionId"
                  :loading="importing"
                  variant="outline"
                  @click="importDocument"
                >
                  Import transcript file
                </UButton>
              </div>

              <div class="space-y-2 rounded-lg border border-default bg-elevated/30 p-3">
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Audio link</p>
                <USelect
                  v-model="selectedRecordingId"
                  :items="recordingOptions"
                  placeholder="Select recording"
                  size="sm"
                  class="w-full"
                />
                <div class="flex flex-wrap items-center gap-2 text-xs text-dimmed">
                  <span v-if="linkedRecordingId">
                    Linked: {{ linkedRecordingLabel }}
                  </span>
                  <UButton
                    size="xs"
                    variant="outline"
                    :disabled="!selectedRecordingId"
                    @click="linkRecordingToTranscript"
                  >
                    Set as default
                  </UButton>
                  <UButton
                    size="xs"
                    variant="ghost"
                    :disabled="!linkedRecordingId"
                    @click="unlinkRecording"
                  >
                    Clear default
                  </UButton>
                </div>
              </div>

              <div class="space-y-2 rounded-lg border border-default bg-elevated/30 p-3">
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Subtitles</p>
                <USelect
                  v-model="selectedSubtitleRecordingId"
                  :items="videoOptions"
                  placeholder="Select video"
                  size="sm"
                  class="w-full"
                />
                <UButton
                  class="w-full justify-center"
                  variant="outline"
                  :disabled="!selectedSubtitleRecordingId"
                  :loading="subtitleAttachLoading"
                  @click="attachTranscriptToVideo"
                >
                  Attach subtitles
                </UButton>
              </div>

              <p v-if="importError" class="text-sm text-error">{{ importError }}</p>
              <p v-if="subtitleAttachError" class="text-sm text-error">{{ subtitleAttachError }}</p>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div>
                <h2 class="text-lg font-semibold">
                  {{ showFullTranscript ? 'Read-only transcript' : 'Transcript preview' }}
                </h2>
                <p class="text-sm text-muted">
                  {{ showFullTranscript ? 'Full transcript text (read-only).' : 'Top segments for quick review.' }}
                </p>
              </div>
            </template>
            <div class="space-y-3">
              <div
                class="whitespace-pre-line text-sm text-muted"
                :class="showFullTranscript ? 'max-h-96 overflow-y-auto' : ''"
              >
                {{ (showFullTranscript ? fullTranscript : transcriptPreview) || 'No transcript yet.' }}
              </div>
              <UButton
                size="sm"
                variant="outline"
                class="w-full justify-center"
                @click="showFullTranscript = !showFullTranscript"
              >
                {{ showFullTranscript ? 'Hide full transcript' : 'Show full transcript' }}
              </UButton>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div>
                <h2 class="text-lg font-semibold">Version history</h2>
                <p class="text-sm text-muted">
                  Restore any previous version.
                </p>
              </div>
            </template>
            <div class="space-y-3">
              <div
                v-for="version in versions"
                :key="version.id"
                class="rounded-lg border border-default bg-elevated/30 p-3 text-sm"
              >
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <p class="font-semibold">Version {{ version.versionNumber }}</p>
                    <p class="text-xs text-dimmed">
                      {{ new Date(version.createdAt).toLocaleString() }} - {{ version.source }}
                    </p>
                  </div>
                  <UButton
                    size="xs"
                    variant="outline"
                    :disabled="document?.currentVersionId === version.id"
                    @click="restoreVersion(version.id)"
                  >
                    Restore
                  </UButton>
                </div>
              </div>
              <p v-if="!versions?.length" class="text-sm text-muted">
                No versions yet.
              </p>
              <p v-if="restoreError" class="text-sm text-error">{{ restoreError }}</p>
            </div>
          </UCard>
        </div>
      </div>

      <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <UCard>
          <template #header>
            <div>
              <h2 class="text-lg font-semibold">Editor</h2>
              <p class="text-sm text-muted">
                Markdown-first editor with version tracking.
              </p>
            </div>
          </template>
          <div class="space-y-4">
            <UTextarea v-model="content" autoresize />
            <div class="flex flex-wrap items-center gap-3">
              <UButton :loading="isSaving" @click="saveDocument">Save version</UButton>
              <div class="flex items-center gap-2">
                <UInput
                  type="file"
                  accept=".txt,.md,.markdown,.vtt"
                  @change="importFile = ($event.target as HTMLInputElement).files?.[0] || null"
                />
                <UButton
                  :disabled="!document?.sessionId"
                  :loading="importing"
                  variant="outline"
                  @click="importDocument"
                >
                  Import file
                </UButton>
              </div>
            </div>
            <p v-if="saveError" class="text-sm text-error">{{ saveError }}</p>
            <p v-if="importError" class="text-sm text-error">{{ importError }}</p>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div>
              <h2 class="text-lg font-semibold">Version history</h2>
              <p class="text-sm text-muted">
                Restore any previous version.
              </p>
            </div>
          </template>
          <div class="space-y-3">
            <div
              v-for="version in versions"
              :key="version.id"
              class="rounded-lg border border-default bg-elevated/30 p-3 text-sm"
            >
              <div class="flex items-center justify-between gap-2">
                <div>
                  <p class="font-semibold">Version {{ version.versionNumber }}</p>
                  <p class="text-xs text-dimmed">
                    {{ new Date(version.createdAt).toLocaleString() }} - {{ version.source }}
                  </p>
                </div>
                <UButton
                  size="xs"
                  variant="outline"
                  :disabled="document?.currentVersionId === version.id"
                  @click="restoreVersion(version.id)"
                >
                  Restore
                </UButton>
              </div>
            </div>
            <p v-if="!versions?.length" class="text-sm text-muted">
              No versions yet.
            </p>
            <p v-if="restoreError" class="text-sm text-error">{{ restoreError }}</p>
          </div>
        </UCard>
      </div>
    </div>
  </UPage>
</template>
