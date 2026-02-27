<script setup lang="ts">
import {
  parseTranscriptSegments,
  serializeTranscriptSegments,
  segmentsToPlainText,
  type TranscriptSegment,
} from '#shared/utils/transcript'
import { getFirstNameTerm } from '#shared/utils/name'
import CampaignDetailTemplate from '~/components/campaign/templates/CampaignDetailTemplate.vue'

definePageMeta({ layout: 'dashboard' })

type DocumentVersionDetail = {
  id: string
  content: string
  format: 'MARKDOWN' | 'PLAINTEXT'
  versionNumber: number
  source: string
  createdAt: string
}

type DocumentVersionListItem = Omit<DocumentVersionDetail, 'content'>

type DocumentDetail = {
  id: string
  type: 'TRANSCRIPT' | 'SUMMARY' | 'NOTES'
  title: string
  sessionId?: string | null
  recordingId?: string | null
  currentVersionId?: string | null
  currentVersion?: DocumentVersionDetail | null
}

type SessionRecording = {
  id: string
  kind: 'AUDIO' | 'VIDEO'
  filename: string
  createdAt: string
  durationSeconds?: number | null
  vttArtifactId?: string | null
}

type SessionDetail = {
  id: string
  guestDungeonMasterName?: string | null
  campaign?: {
    dungeonMasterName?: string | null
  } | null
}

type CampaignDetail = {
  id: string
  dungeonMasterName?: string | null
}

type GlossaryEntry = {
  id: string
  type: 'PC' | 'NPC' | 'ITEM' | 'LOCATION'
  name: string
  aliases?: string | null
}

type HighlightPart = { text: string; match: boolean }

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const documentId = computed(() => route.params.documentId as string)
const returnTo = computed(() =>
  typeof route.query.returnTo === 'string' && route.query.returnTo
    ? route.query.returnTo
    : ''
)
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
  () => request<DocumentVersionListItem[]>(`/api/documents/${documentId.value}/versions`)
)

const content = ref('')
const segments = ref<TranscriptSegment[]>([])
const isDirty = ref(false)
const savedTranscriptState = ref('')
const transcriptHistory = ref<TranscriptSegment[][]>([])
const transcriptFuture = ref<TranscriptSegment[][]>([])
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
const selectionAnchorSegmentId = ref('')
const pendingSelectionClick = ref<{ segmentId: string; shiftKey: boolean } | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined
const searchFilterEnabled = ref(false)
const speakerFilterSelection = ref<string[]>([])
const startTimeFilter = ref('')
const endTimeFilter = ref('')
const minLengthFilter = ref('')
const maxLengthFilter = ref('')
const speakerBulkInput = ref('')
const selectedSpeakerPreset = ref<string | undefined>(undefined)
const speakerDrafts = ref<Record<string, string>>({})

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

const { data: sessionDetail } = await useAsyncData(
  () => `document-session-detail-${documentId.value}`,
  async () => {
    if (!document.value?.sessionId) return null
    return request<SessionDetail>(`/api/sessions/${document.value.sessionId}`)
  },
  { watch: [document] }
)

const { data: campaignDetail } = await useAsyncData(
  () => `document-campaign-detail-${campaignId.value}`,
  () => request<CampaignDetail>(`/api/campaigns/${campaignId.value}`),
  { watch: [campaignId] }
)

const { data: pcGlossaryEntries } = await useAsyncData(
  () => `document-speaker-pc-glossary-${campaignId.value}`,
  () => request<GlossaryEntry[]>(`/api/campaigns/${campaignId.value}/glossary?type=PC`),
  { watch: [campaignId] }
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
    return payload?.url || ''
  },
  { watch: [selectedRecordingId] }
)

const cloneSegments = (value: TranscriptSegment[]) =>
  value.map((segment) => ({
    ...segment,
    startMs: segment.startMs ?? null,
    endMs: segment.endMs ?? null,
    speaker: segment.speaker ?? null,
    confidence: segment.confidence ?? null,
    disabled: Boolean(segment.disabled),
  }))

const syncSpeakerDrafts = () => {
  speakerDrafts.value = Object.fromEntries(
    segments.value.map((segment) => [segment.id, segment.speaker ?? ''])
  )
}

const reconcileSpeakerDrafts = (
  beforeSegments: TranscriptSegment[],
  nextSegments: TranscriptSegment[]
) => {
  const beforeById = new Map(beforeSegments.map((segment) => [segment.id, segment.speaker ?? '']))
  const nextIds = new Set(nextSegments.map((segment) => segment.id))
  const nextDrafts: Record<string, string> = Object.fromEntries(
    Object.entries(speakerDrafts.value).filter(([segmentId]) => nextIds.has(segmentId))
  )
  nextSegments.forEach((segment) => {
    const previousSpeaker = beforeById.get(segment.id) ?? ''
    const existingDraft = nextDrafts[segment.id]
    if (existingDraft === undefined || existingDraft === previousSpeaker) {
      nextDrafts[segment.id] = segment.speaker ?? ''
    }
  })
  speakerDrafts.value = nextDrafts
}

const updateDirtyState = () => {
  if (document.value?.type !== 'TRANSCRIPT') {
    isDirty.value = false
    return
  }
  isDirty.value = serializeTranscriptSegments(segments.value) !== savedTranscriptState.value
}

const resetTranscriptHistory = (nextSegments: TranscriptSegment[]) => {
  segments.value = cloneSegments(nextSegments)
  transcriptHistory.value = []
  transcriptFuture.value = []
  savedTranscriptState.value = serializeTranscriptSegments(segments.value)
  syncSpeakerDrafts()
  updateDirtyState()
}

const pushHistoryState = (snapshot: TranscriptSegment[]) => {
  transcriptHistory.value.push(cloneSegments(snapshot))
  if (transcriptHistory.value.length > 250) {
    transcriptHistory.value.shift()
  }
}

const applySegmentMutation = (mutator: (draft: TranscriptSegment[]) => void) => {
  if (document.value?.type !== 'TRANSCRIPT') return
  const before = cloneSegments(segments.value)
  const draft = cloneSegments(segments.value)
  mutator(draft)
  const beforeSerialized = serializeTranscriptSegments(before)
  const afterSerialized = serializeTranscriptSegments(draft)
  if (beforeSerialized === afterSerialized) return
  pushHistoryState(before)
  transcriptFuture.value = []
  segments.value = draft
  reconcileSpeakerDrafts(before, draft)
  updateDirtyState()
}

const canUndo = computed(() => transcriptHistory.value.length > 0)
const canRedo = computed(() => transcriptFuture.value.length > 0)

const undoTranscriptChange = () => {
  if (!canUndo.value) return
  const previous = transcriptHistory.value.pop()
  if (!previous) return
  transcriptFuture.value.push(cloneSegments(segments.value))
  segments.value = cloneSegments(previous)
  syncSpeakerDrafts()
  updateDirtyState()
}

const redoTranscriptChange = () => {
  if (!canRedo.value) return
  const next = transcriptFuture.value.pop()
  if (!next) return
  pushHistoryState(segments.value)
  segments.value = cloneSegments(next)
  syncSpeakerDrafts()
  updateDirtyState()
}

const handleTranscriptKeydown = (event: KeyboardEvent) => {
  if (document.value?.type !== 'TRANSCRIPT') return
  const isModifierPressed = event.metaKey || event.ctrlKey
  if (!isModifierPressed || event.altKey) return
  const key = event.key.toLowerCase()
  if (key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      redoTranscriptChange()
      return
    }
    undoTranscriptChange()
    return
  }
  if (key === 'y') {
    event.preventDefault()
    redoTranscriptChange()
  }
}

onMounted(() => {
  hasMounted.value = true
  globalThis.window?.addEventListener('keydown', handleTranscriptKeydown)
})

onBeforeUnmount(() => {
  if (playbackRangeTimer) {
    clearInterval(playbackRangeTimer)
  }
  globalThis.window?.removeEventListener('keydown', handleTranscriptKeydown)
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
      resetTranscriptHistory(parseTranscriptSegments(nextContent))
      lastSavedAt.value = value?.currentVersion?.createdAt || null
      windowStart.value = 0
      selectedSegmentId.value = ''
      selectedSegmentIds.value = []
      selectionAnchorSegmentId.value = ''
      pendingSelectionClick.value = null
      activeMatchIndex.value = 0
    } else {
      segments.value = []
      transcriptHistory.value = []
      transcriptFuture.value = []
      savedTranscriptState.value = ''
      speakerDrafts.value = {}
      isDirty.value = false
      selectionAnchorSegmentId.value = ''
      pendingSelectionClick.value = null
    }
  },
  { immediate: true }
)

watch(
  () => [videoOptions.value, recordingOptions.value],
  ([videoList = [], recordingList = []]) => {
    if (videoList.length && !selectedSubtitleRecordingId.value) {
      const firstVideo = videoList[0]
      if (firstVideo) {
        selectedSubtitleRecordingId.value = firstVideo.value
      }
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

watch(
  () => selectedSpeakerPreset.value,
  (value) => {
    const normalized = String(value || '').trim()
    if (!normalized) return
    speakerBulkInput.value = normalized
  }
)

const parseTimeInput = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parts = trimmed.split(':').map((part) => Number(part))
  if (parts.some((part) => Number.isNaN(part))) return null
  const p0 = parts[0] ?? 0
  const p1 = parts[1] ?? 0
  const p2 = parts[2] ?? 0
  if (parts.length === 1) return p0 * 1000
  if (parts.length === 2) return (p0 * 60 + p1) * 1000
  if (parts.length === 3) return (p0 * 3600 + p1 * 60 + p2) * 1000
  return null
}

const parseAliasTerms = (aliases?: string | null) =>
  (aliases || '')
    .split(',')
    .map((alias) => alias.trim())
    .filter(Boolean)

const speakerPresetOptions = computed(() => {
  const options: string[] = []
  const dmRaw =
    sessionDetail.value?.guestDungeonMasterName ||
    campaignDetail.value?.dungeonMasterName ||
    ''
  const dmFirstName = getFirstNameTerm(dmRaw)
  if (dmFirstName) {
    options.push(`DM (${dmFirstName})`)
  }

  const pcOptions = (pcGlossaryEntries.value || [])
    .map((entry) => {
      const characterFirstName = getFirstNameTerm(entry.name)
      if (!characterFirstName) return ''
      const playerName = parseAliasTerms(entry.aliases)[0] || ''
      return playerName
        ? `${characterFirstName} (${playerName})`
        : characterFirstName
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

  const seen = new Set<string>()
  pcOptions.forEach((option) => {
    const key = option.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      options.push(option)
    }
  })

  return options
})

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

const toggleSegmentDisabled = (segmentId: string) => {
  applySegmentMutation((draft) => {
    const segment = draft.find((item) => item.id === segmentId)
    if (!segment) return
    segment.disabled = !segment.disabled
  })
}

const selectedSet = computed(() => new Set(selectedSegmentIds.value))

const setSegmentSelection = (segmentId: string, selected: boolean) => {
  const next = new Set(selectedSegmentIds.value)
  if (selected) {
    next.add(segmentId)
  } else {
    next.delete(segmentId)
  }
  selectedSegmentIds.value = Array.from(next)
}

const selectVisibleSegmentRange = (fromSegmentId: string, toSegmentId: string) => {
  const ids = visibleSegments.value.map((segment) => segment.id)
  const fromIndex = ids.indexOf(fromSegmentId)
  const toIndex = ids.indexOf(toSegmentId)
  if (fromIndex < 0 || toIndex < 0) {
    setSegmentSelection(toSegmentId, true)
    return
  }

  const start = Math.min(fromIndex, toIndex)
  const end = Math.max(fromIndex, toIndex)
  const next = new Set(selectedSegmentIds.value)
  for (let index = start; index <= end; index += 1) {
    const id = ids[index]
    if (id) next.add(id)
  }
  selectedSegmentIds.value = Array.from(next)
}

const noteSegmentSelectionClick = (event: MouseEvent, segmentId: string) => {
  pendingSelectionClick.value = { segmentId, shiftKey: event.shiftKey }
}

const handleSegmentSelectionUpdate = (
  segmentId: string,
  modelValue: boolean | 'indeterminate'
) => {
  const selected = modelValue === true
  const pending = pendingSelectionClick.value
  const shouldSelectRange =
    selected &&
    pending?.segmentId === segmentId &&
    pending.shiftKey &&
    Boolean(selectionAnchorSegmentId.value)

  if (shouldSelectRange) {
    selectVisibleSegmentRange(selectionAnchorSegmentId.value, segmentId)
  } else {
    setSegmentSelection(segmentId, selected)
  }

  if (selected) {
    selectionAnchorSegmentId.value = segmentId
  } else if (selectionAnchorSegmentId.value === segmentId) {
    selectionAnchorSegmentId.value = ''
  }

  pendingSelectionClick.value = null
}

const selectAllFiltered = () => {
  selectedSegmentIds.value = filteredSegments.value.map((segment) => segment.id)
  selectionAnchorSegmentId.value = ''
}

const clearSelection = () => {
  selectedSegmentIds.value = []
  selectionAnchorSegmentId.value = ''
}

const applyDisableToSelection = (disabled: boolean) => {
  const selection = selectedSet.value
  if (!selection.size) return
  applySegmentMutation((draft) => {
    draft.forEach((segment) => {
      if (selection.has(segment.id)) {
        segment.disabled = disabled
      }
    })
  })
}

const applySpeakerToSelection = (speakerValue: string) => {
  const trimmed = speakerValue.trim()
  if (!trimmed) return
  const selection = selectedSet.value
  if (!selection.size) return
  applySegmentMutation((draft) => {
    draft.forEach((segment) => {
      if (selection.has(segment.id)) {
        segment.speaker = trimmed
      }
    })
  })
}

const applySpeakerToFiltered = (speakerValue: string) => {
  const trimmed = speakerValue.trim()
  if (!trimmed) return
  const filteredIds = new Set(filteredSegments.value.map((segment) => segment.id))
  applySegmentMutation((draft) => {
    draft.forEach((segment) => {
      if (filteredIds.has(segment.id)) {
        segment.speaker = trimmed
      }
    })
  })
}

const applySpeakerPresetToSegment = (segmentId: string, preset: string) => {
  const trimmed = preset.trim()
  if (!trimmed) return
  applySegmentMutation((draft) => {
    const segment = draft.find((item) => item.id === segmentId)
    if (!segment) return
    segment.speaker = trimmed
  })
  speakerDrafts.value[segmentId] = trimmed
}

const applySpeakerPresetToSegmentWithClose = (
  segmentId: string,
  preset: string,
  close: () => void
) => {
  applySpeakerPresetToSegment(segmentId, preset)
  close()
}

const clearSpeakerUpdateInputs = () => {
  selectedSpeakerPreset.value = undefined
  speakerBulkInput.value = ''
}

const getSpeakerDraft = (segment: TranscriptSegment) =>
  speakerDrafts.value[segment.id] ?? segment.speaker ?? ''

const setSpeakerDraft = (segmentId: string, value: string | number | null | undefined) => {
  speakerDrafts.value[segmentId] = value == null ? '' : String(value)
}

const commitSpeakerDraft = (segmentId: string) => {
  const draft = (speakerDrafts.value[segmentId] ?? '').trim()
  const nextSpeaker = draft || null
  applySegmentMutation((segmentsDraft) => {
    const segment = segmentsDraft.find((item) => item.id === segmentId)
    if (!segment) return
    const currentSpeaker = (segment.speaker || '').trim() || null
    if (currentSpeaker === nextSpeaker) return
    segment.speaker = nextSpeaker
  })
  speakerDrafts.value[segmentId] = nextSpeaker ?? ''
}

const setSegmentText = (segmentId: string, value: string | number | null | undefined) => {
  const nextText = value == null ? '' : String(value)
  applySegmentMutation((draft) => {
    const segment = draft.find((item) => item.id === segmentId)
    if (!segment) return
    if (segment.text === nextText) return
    segment.text = nextText
  })
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
    savedTranscriptState.value =
      isTranscript ? payloadContent : savedTranscriptState.value
    updateDirtyState()
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
  <CampaignDetailTemplate
    :back-to="document?.sessionId ? (returnTo || `/campaigns/${campaignId}/sessions/${document.sessionId}`) : `/campaigns/${campaignId}/sessions`"
    back-label="Back to session"
    headline="Session Asset"
    :title="document?.title || 'Document editor'"
    :description="document?.type === 'TRANSCRIPT'
      ? 'Transcript editor with synchronized playback tools.'
      : 'Markdown-first session document editor with version history.'"
  >
    <template #actions>
      <UButton variant="outline" :to="`/campaigns/${campaignId}/sessions`">
        All sessions
      </UButton>
    </template>

      <div v-if="pending" class="grid gap-4">
        <UCard class="h-32 animate-pulse" />
        <UCard class="h-52 animate-pulse" />
      </div>

      <UCard v-else-if="error" class="text-center">
        <p class="text-sm text-error">Unable to load this document.</p>
        <UButton class="mt-4" variant="outline" @click="() => refresh()">Try again</UButton>
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
              <div class="space-y-3 rounded-lg border border-default/60 bg-elevated/20 p-3">
                <div class="space-y-2">
                  <p class="text-[11px] font-medium uppercase tracking-[0.2em] text-dimmed">
                    Filtering
                  </p>
                  <div class="flex flex-wrap items-center gap-2">
                    <UInput
                      v-model="searchInput"
                      size="xs"
                      class="w-56"
                      placeholder="Search transcript"
                      :ui="{ trailing: 'pe-1' }">
                      <template v-if="searchInput?.length" #trailing>
                        <UButton
                          color="neutral"
                          variant="link"
                          size="sm"
                          icon="i-lucide-circle-x"
                          aria-label="Clear input"
                          @click="searchInput = ''"
                        />
                      </template>
                    </UInput>
                    <UCheckbox v-model="searchFilterEnabled" label="Filter search matches" />
                    <UButton
                      size="xs"
                      variant="outline"
                      :disabled="!matchIndices.length"
                      @click="goToMatch(-1)"
                    >
                      Prev Match
                    </UButton>
                    <UButton
                      size="xs"
                      variant="outline"
                      :disabled="!matchIndices.length"
                      @click="goToMatch(1)"
                    >
                      Next Match
                    </UButton>
                    <span v-if="matchIndices.length" class="text-xs text-dimmed">
                      {{ activeMatchIndex + 1 }}/{{ matchIndices.length }}
                    </span>
                  </div>
                </div>

                <div>
                  <div class="grid grid-cols-1 gap-4 rounded-lg border border-default/60 bg-default/30 p-3 md:grid-cols-3">
                    <div class="space-y-2 md:border-r md:border-default/60 md:pr-4">
                      <p class="text-[11px] font-medium uppercase tracking-[0.2em] text-dimmed">
                        Speakers
                      </p>
                      <USelectMenu
                        v-model="speakerFilterSelection"
                        size="xs"
                        class="w-full"
                        clear
                        multiple
                        :items="speakerOptions"
                        placeholder="All speakers"
                      />
                    </div>

                    <div class="space-y-2 md:border-r md:border-default/60 md:pr-4">
                      <p class="text-[11px] font-medium uppercase tracking-[0.2em] text-dimmed">
                        Time Range
                      </p>
                      <div class="flex items-center gap-2">
                        <UFieldGroup class="w-full">
                          <UInput
                            v-model="startTimeFilter"
                            :ui="{
                              base: 'pl-11',
                              leading: 'pointer-events-none',
                              trailing: 'pe-1'
                            }"
                            size="xs"
                            class="w-1/2 min-w-0"
                            placeholder="mm:ss">
                            <template #leading>
                              <p class="text-xs text-muted">
                                Start
                              </p>
                            </template>
                            <template v-if="startTimeFilter?.length" #trailing>
                              <UButton
                                color="neutral"
                                variant="link"
                                size="sm"
                                icon="i-lucide-circle-x"
                                aria-label="Clear input"
                                @click="startTimeFilter = ''"
                              />
                            </template>
                          </UInput>
                          <UInput
                            v-model="endTimeFilter"
                            :ui="{
                              base: 'pl-11',
                              leading: 'pointer-events-none',
                              trailing: 'pe-1'
                            }"
                            size="xs"
                            class="w-1/2 min-w-0"
                            placeholder="mm:ss">
                            <template #leading>
                              <p class="text-xs text-muted">
                                End
                              </p>
                            </template>
                            <template v-if="endTimeFilter?.length" #trailing>
                              <UButton
                                color="neutral"
                                variant="link"
                                size="sm"
                                icon="i-lucide-circle-x"
                                aria-label="Clear input"
                                @click="endTimeFilter = ''"
                              />
                            </template>
                          </UInput>
                        </UFieldGroup>
                      </div>
                    </div>

                    <div class="space-y-2">
                      <p class="text-[11px] font-medium uppercase tracking-[0.2em] text-dimmed">
                        Duration Filter
                      </p>
                      <div class="flex items-center gap-2">
                        <UFieldGroup class="w-full">
                          <UInput
                            v-model="minLengthFilter"
                            :ui="{
                              base: 'pl-10',
                              leading: 'pointer-events-none',
                              trailing: 'pe-1'
                            }"
                            size="xs"
                            class="w-1/2 min-w-0"
                            placeholder="seconds">
                            <template #leading>
                              <p class="text-xs text-muted">
                                Min
                              </p>
                            </template>
                            <template v-if="minLengthFilter?.length" #trailing>
                              <UButton
                                color="neutral"
                                variant="link"
                                size="sm"
                                icon="i-lucide-circle-x"
                                aria-label="Clear input"
                                @click="minLengthFilter = ''"
                              />
                            </template>
                          </UInput>
                          <UInput
                            v-model="maxLengthFilter"
                            :ui="{
                              base: 'pl-10',
                              leading: 'pointer-events-none',
                              trailing: 'pe-1'
                            }"
                            size="xs"
                            class="w-1/2 min-w-0"
                            placeholder="seconds">
                            <template #leading>
                              <p class="text-xs text-muted">
                                Max
                              </p>
                            </template>
                            <template v-if="maxLengthFilter?.length" #trailing>
                              <UButton
                                color="neutral"
                                variant="link"
                                size="sm"
                                icon="i-lucide-circle-x"
                                aria-label="Clear input"
                                @click="maxLengthFilter = ''"
                              />
                            </template>
                          </UInput>
                        </UFieldGroup>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="space-y-3 rounded-lg border border-default/60 bg-elevated/20 p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="text-[11px] font-medium uppercase tracking-[0.2em] text-dimmed">
                    Updates
                  </p>
                  <div class="flex items-center justify-end gap-2">
                    <UButton
                      size="xs"
                      variant="outline"
                      icon="i-lucide-undo-2"
                      :disabled="!canUndo"
                      @click="undoTranscriptChange"
                    >
                      Undo
                    </UButton>
                    <UButton
                      size="xs"
                      variant="outline"
                      icon="i-lucide-redo-2"
                      :disabled="!canRedo"
                      @click="redoTranscriptChange"
                    >
                      Redo
                    </UButton>
                  </div>
                </div>
                <div class="grid grid-cols-1 gap-4 rounded-lg border border-default/60 bg-default/30 p-3 md:grid-cols-2">
                  <div class="space-y-2 md:border-r md:border-default/60 md:pr-4">
                    <p class="text-[11px] font-medium uppercase tracking-[0.2em] text-dimmed">
                      Set Speaker
                    </p>
                    <div class="flex flex-wrap items-center gap-2">
                      <UFieldGroup class="w-full">
                        <USelectMenu
                          v-model="selectedSpeakerPreset"
                          :items="speakerPresetOptions"
                          :search-input="{ placeholder: 'Search speaker presets...' }"
                          size="xs"
                          class="w-1/2 min-w-0"
                          placeholder="Select character"
                        />
                        <UInput
                          v-model="speakerBulkInput"
                          size="xs"
                          class="w-1/2 min-w-0"
                          placeholder="Set custom speaker"
                        />
                      </UFieldGroup>
                      <div class="flex flex-wrap items-center gap-2">
                        <UButton
                          size="xs"
                          variant="outline"
                          :disabled="!selectedSegmentIds.length"
                          @click="applySpeakerToSelection(speakerBulkInput)"
                        >
                          Update Selection
                        </UButton>
                        <UButton
                          size="xs"
                          variant="outline"
                          :disabled="!filteredSegments.length"
                          @click="applySpeakerToFiltered(speakerBulkInput)"
                        >
                          Update Filtered
                        </UButton>
                        <UButton
                          size="xs"
                          variant="ghost"
                          icon="i-lucide-x"
                          :disabled="!selectedSpeakerPreset && !speakerBulkInput.trim()"
                          @click="clearSpeakerUpdateInputs"
                        >
                          Clear
                        </UButton>
                      </div>
                    </div>
                  </div>

                  <div class="space-y-2">
                    <p class="text-[11px] font-medium uppercase tracking-[0.2em] text-dimmed">
                      Enable/Disable Segments
                    </p>
                    <div class="flex flex-wrap items-center gap-2">
                      <UButton
                        size="xs"
                        variant="outline"
                        :disabled="!selectedSegmentIds.length"
                        @click="applyDisableToSelection(true)"
                      >
                        Disable Selected
                      </UButton>
                      <UButton
                        size="xs"
                        variant="outline"
                        :disabled="!selectedSegmentIds.length"
                        @click="applyDisableToSelection(false)"
                      >
                        Enable Selected
                      </UButton>
                    </div>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div class="space-y-2">
                    <div class="flex items-center gap-2">
                      <p class="text-[11px] font-medium uppercase tracking-[0.2em] text-dimmed pl-2">
                        Selection
                      </p>
                      <span class="text-xs text-dimmed">{{ selectedSegmentIds.length }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <UButton size="xs" variant="ghost" @click="selectAllFiltered">
                        Select filtered
                      </UButton>
                      <UButton
                        size="xs"
                        variant="ghost"
                        :disabled="!selectedSegmentIds.length"
                        @click="clearSelection"
                      >
                        Clear
                      </UButton>
                      <UButton
                        size="xs"
                        variant="outline"
                        :disabled="!selectedSegmentIds.length"
                        @click="playSelection"
                      >
                        Play Selection Range
                      </UButton>
                    </div>
                </div>

                <div class="space-y-2 md:text-right">
                    <div class="flex items-center gap-2 md:justify-end">
                      <p class="text-[11px] font-medium uppercase tracking-[0.2em] text-dimmed">
                        View Window
                      </p>
                      <span class="text-xs text-dimmed">{{ windowLabel }}</span>
                    </div>
                    <div class="flex items-center gap-2 md:justify-end">
                      <UButton
                        size="xs"
                        variant="ghost"
                        :disabled="!canPrevWindow"
                        @click="moveWindow(-1)"
                      >
                        Previous
                      </UButton>
                      <UButton
                        size="xs"
                        variant="ghost"
                        :disabled="!canNextWindow"
                        @click="moveWindow(1)"
                      >
                        Next
                      </UButton>
                    </div>
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
                    <UCheckbox
                      :model-value="selectedSet.has(segment.id)"
                      @click="(event: MouseEvent) => noteSegmentSelectionClick(event, segment.id)"
                      @update:model-value="(value) => handleSegmentSelectionUpdate(segment.id, value)"
                    />
                    <span>{{ formatTimestamp(segment.startMs) }}</span>
                    <span v-if="segment.endMs !== null">- {{ formatTimestamp(segment.endMs) }}</span>
                    <span v-if="formatDuration(segment)">
                      - {{ formatDuration(segment) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <UButton
                      size="xs"
                      variant="outline"
                      @click="toggleSegmentDisabled(segment.id)"
                    >
                      {{ segment.disabled ? 'Enable' : 'Disable' }}
                    </UButton>
                    <UButton
                      size="xs"
                      icon="i-lucide-play"
                      color="primary"
                      :disabled="segment.startMs === null || segment.endMs === null"
                      @click="playSegment(segment)"
                    >
                      Play segment
                    </UButton>
                    <UButton
                      size="xs"
                      variant="outline"
                      icon="i-lucide-skip-forward"
                      :disabled="segment.startMs === null"
                      @click="jumpToSegment(segment)"
                    >
                      Jump
                    </UButton>
                  </div>
                </div>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <UInput
                    :model-value="getSpeakerDraft(segment)"
                    size="xs"
                    class="w-36"
                    placeholder="Speaker"
                    :ui="{ trailing: 'pe-1' }"
                    @update:model-value="(value) => setSpeakerDraft(segment.id, value)"
                    @blur="commitSpeakerDraft(segment.id)"
                    @keydown.enter.prevent="commitSpeakerDraft(segment.id)"
                  >
                    <template #trailing>
                      <UPopover :content="{ side: 'top', align: 'start' }" :ui="{ content: 'w-56 p-2' }">
                        <UButton
                          color="neutral"
                          variant="link"
                          size="sm"
                          icon="i-lucide-arrow-right-left"
                          :disabled="!speakerPresetOptions.length"
                          aria-label="Swap speaker from preset"
                        />
                        <template #content="{ close }">
                          <div class="space-y-1">
                            <p class="px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-dimmed">
                              Swap Speaker
                            </p>
                            <div v-if="speakerPresetOptions.length" class="max-h-48 space-y-1 overflow-y-auto pr-1">
                              <UButton
                                v-for="option in speakerPresetOptions"
                                :key="`swap-${segment.id}-${option}`"
                                size="xs"
                                variant="ghost"
                                class="w-full justify-start"
                                @click="applySpeakerPresetToSegmentWithClose(segment.id, option, close)"
                              >
                                {{ option }}
                              </UButton>
                            </div>
                            <p v-else class="px-1 text-xs text-dimmed">
                              No speaker presets available.
                            </p>
                          </div>
                        </template>
                      </UPopover>
                    </template>
                  </UInput>
                  <span v-if="segment.disabled" class="rounded-full bg-warning/20 px-2 py-0.5 text-warning">
                    Disabled in preview
                  </span>
                  <span v-if="segment.confidence !== null && segment.confidence !== undefined" class="text-dimmed">
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
                  :model-value="segment.text"
                  :rows="2"
                  size="sm"
                  class="mt-2"
                  @update:model-value="(value) => setSegmentText(segment.id, value)"
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
              <p v-if="player.state.value.error" class="text-sm text-error">
                {{ player.state.value.error }}
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
  </CampaignDetailTemplate>
</template>

