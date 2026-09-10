import type { Ref } from 'vue'
import type { TimelineItem } from '@nuxt/ui'
import {
  isSegmentedTranscript,
  parseTranscriptSegments,
  segmentsToPlainText,
} from '#shared/utils/transcript'
import { formatSessionDate, serializeSessionDateInput } from '~/utils/session-date'

const workflowStepOrder = ['recordings', 'transcription', 'summary', 'suggestions', 'recap'] as const
type WorkflowStep = (typeof workflowStepOrder)[number]

/** Construct once, synchronously in the session parent after its resource has loaded. */
export function useSessionWorkspaceViewModel(options: {
  campaignId: Ref<string>
  sessionId: Ref<string>
  resource: Awaited<ReturnType<typeof useSessionWorkspace>>
}) {
  const route = useRoute()
  const { campaignId, sessionId, resource } = options
  const { request } = useApi()
  const toast = useToast()
  const player = useMediaPlayer()
  const isEditSessionOpen = ref(false)

  const {
    session,
    recordings,
    recaps,
    transcriptDoc,
    summaryDoc,
    canWriteContent,
    refreshWorkspace,
  } = resource

  const selectedRecapKind = ref<'AUDIO' | 'VIDEO'>('AUDIO')
  const recap = computed(() => recaps.value.find((item) =>
    (item.mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO') === selectedRecapKind.value
  ) ?? null)

  const form = reactive({
    title: '',
    sessionNumber: '',
    playedAt: '',
    guestDungeonMasterName: '',
    notes: '',
  })
  const isSaving = ref(false)
  const saveError = ref('')
  const subtitleAttachLoading = ref(false)
  const subtitleAttachError = ref('')
  const selectedSubtitleRecordingId = ref('')
  const showFullTranscript = ref(false)

  const transcriptForm = reactive({
    content: '',
  })
  const summaryForm = reactive({
    content: '',
  })
  const stepParam = computed(() =>
    typeof route.params.step === 'string' ? route.params.step : ''
  )

  const recording = useSessionRecordings({
    sessionId,
    recordings,
    refreshRecordings: refreshWorkspace,
  })

  const recapActions = useSessionRecap({
    sessionId,
    recap,
    selectedRecapKind,
    refreshRecap: refreshWorkspace,
  })

  const jobs = useSessionJobs(sessionId)
  const summaryJobs = useSessionSummaryJobs({
    jobs,
    sessionId,
    transcriptDoc,
    refreshSummary: refreshWorkspace,
  })

  const suggestions = useSessionSuggestionJobs({
    jobs,
    sessionId,
    summaryDoc,
  })

  const transcriptContent = toRef(transcriptForm, 'content')
  const summaryContent = toRef(summaryForm, 'content')

  const documents = useSessionDocuments({
    sessionId,
    sessionTitle: computed(() => session.value?.title),
    transcriptDoc,
    summaryDoc,
    transcriptContent,
    summaryContent,
    refreshTranscript: refreshWorkspace,
    refreshSummary: refreshWorkspace,
  })

  const sessionDraft = useEditorDraft(() => ({ ...form }), value => Object.assign(form, value))
  watch(() => session.value, value => {
    if (!value) return
    sessionDraft.sync({
      title: value.title || '', sessionNumber: value.sessionNumber?.toString() || '',
      playedAt: value.playedAt?.slice(0, 10) || '',
      guestDungeonMasterName: value.guestDungeonMasterName || '', notes: value.notes || '',
    }, value.id)
  }, { immediate: true })

  const sessionDungeonMasterLabel = computed(() =>
    session.value?.guestDungeonMasterName
    || session.value?.campaign?.dungeonMasterName
    || 'None'
  )
  const sessionHeaderDescription = computed(() => {
    if (!session.value) return 'Manage recordings, transcript, summary, and recap for this session.'
    const details = [
      session.value.sessionNumber ? `Session ${session.value.sessionNumber}` : 'Session',
      formatSessionDate(session.value.playedAt),
    ]
    return details.join(' • ')
  })

  const recordingsCount = computed(() => recordings.value?.length || 0)
  const recapStatus = computed(() => (recaps.value.length ? 'Attached' : 'Missing'))
  const transcriptStatus = computed(() => (transcriptDoc.value ? 'Available' : 'Missing'))
  const summaryStatus = computed(() => (summaryDoc.value ? 'Available' : 'Missing'))
  const hasRecordings = computed(() => (recordings.value?.length || 0) > 0)
  const hasTranscript = computed(() => Boolean(transcriptDoc.value))
  const hasSummary = computed(() => Boolean(summaryDoc.value))
  const hasSuggestionJob = computed(() => Boolean(suggestions.suggestionJob.value))
  const hasRecap = computed(() => Boolean(recaps.value.length))
  const videoOptions = computed(() =>
    (recordings.value || [])
      .filter((recording) => recording.kind === 'VIDEO')
      .map((recording) => ({
        label: recording.filename,
        value: recording.id,
      }))
  )

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

  watch(
    () => transcriptDoc.value,
    (value) => {
      transcriptForm.content = value?.currentVersion?.content || ''
    },
    { immediate: true }
  )

  const summaryDraft = useEditorDraft(() => ({ ...summaryForm }), value => Object.assign(summaryForm, value))
  watch([sessionId, summaryDoc], ([id, value]) => {
    summaryDraft.sync({ content: value?.currentVersion?.content || '' }, id)
  }, { immediate: true })
  const saveSummary = async () => {
    if (!canWriteContent.value || documents.summarySaving.value || documents.summaryImporting.value) return
    const submitted = summaryDraft.snapshot()
    if (await documents.saveSummary()) summaryDraft.accept(submitted)
  }

  const sessionNavigationItems = computed<TimelineItem[]>(() => [
    {
      title: 'Overview',
      description: 'Session overview',
      value: 'overview',
      icon: 'i-lucide-layout-dashboard',
    },
    {
      title: 'Recordings',
      description: hasRecordings.value ? 'Upload complete' : 'Upload audio/video',
      value: 'recordings',
      icon: 'i-lucide-mic',
    },
    {
      title: 'Transcription',
      description: hasTranscript.value ? 'Review & edit transcript' : 'Await transcript',
      value: 'transcription',
      icon: 'i-lucide-scroll-text',
    },
    {
      title: 'Summary',
      description: hasSummary.value ? 'Generate and review summary' : 'Send to n8n',
      value: 'summary',
      icon: 'i-lucide-book-open',
    },
    {
      title: 'Suggestions',
      description: 'Review suggested updates',
      value: 'suggestions',
      icon: 'i-lucide-git-merge',
    },
    {
      title: 'Recap',
      description: hasRecap.value ? 'Recap attached' : 'Upload audio or video recap',
      value: 'recap',
      icon: 'i-lucide-headphones',
    },
  ])

  const defaultStep = computed(() => {
    if (!hasRecordings.value) return 'recordings'
    if (!hasTranscript.value) return 'transcription'
    if (!hasSummary.value) return 'summary'
    if (!hasSuggestionJob.value) return 'suggestions'
    if (!hasRecap.value) return 'recap'
    return 'recordings'
  })

  const openSessionSection = async (section: string) => {
    if (section === 'overview') {
      await navigateTo(`/campaigns/${campaignId.value}/sessions/${sessionId.value}`)
      return
    }
    const normalizedStep = workflowStepOrder.includes(section as WorkflowStep)
      ? section
      : defaultStep.value
    await navigateTo(`/campaigns/${campaignId.value}/sessions/${sessionId.value}/${normalizedStep}`)
  }

  watch(
    () => stepParam.value,
    async (value) => {
      if (!value) return
      if (value === 'overview') {
        await navigateTo(`/campaigns/${campaignId.value}/sessions/${sessionId.value}`)
        return
      }
      if (!workflowStepOrder.includes(value as WorkflowStep)) {
        await navigateTo(`/campaigns/${campaignId.value}/sessions/${sessionId.value}/${defaultStep.value}`)
      }
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
        const firstVideo = value[0]
        if (firstVideo) {
          selectedSubtitleRecordingId.value = firstVideo.value
        }
      }
    },
    { immediate: true }
  )

  const saveSession = async () => {
    if (!canWriteContent.value || isSaving.value) return
    const submitted = sessionDraft.snapshot()
    saveError.value = ''
    isSaving.value = true
    try {
      await request(`/api/sessions/${sessionId.value}`, {
        method: 'PATCH',
        body: {
          title: form.title || undefined,
          sessionNumber: form.sessionNumber ? Number(form.sessionNumber) : undefined,
          playedAt: serializeSessionDateInput(form.playedAt),
          guestDungeonMasterName: form.guestDungeonMasterName || null,
          notes: form.notes || null,
        },
      })
      sessionDraft.accept(submitted)
      await refreshWorkspace()
      toast.add({
        title: 'Session saved',
        color: 'success',
        icon: 'i-lucide-check',
      })
      if (isEditSessionOpen.value) isEditSessionOpen.value = false
    } catch (error) {
      saveError.value =
        (error as Error & { message?: string }).message || 'Unable to update session.'
    } finally {
      isSaving.value = false
    }
  }

  const openEditSession = () => {
    if (!canWriteContent.value) return
    sessionDraft.discard()
    isEditSessionOpen.value = true
  }

  const attachTranscriptToVideo = async () => {
    if (!canWriteContent.value) return
    if (!selectedSubtitleRecordingId.value) return
    subtitleAttachError.value = ''
    subtitleAttachLoading.value = true
    try {
      await request(`/api/recordings/${selectedSubtitleRecordingId.value}/captions`, {
        method: 'POST',
        body: { mode: 'from-transcript' },
      })
      await refreshWorkspace()
    } catch (error) {
      subtitleAttachError.value =
        (error as Error & { message?: string }).message || 'Unable to attach subtitles.'
    } finally {
      subtitleAttachLoading.value = false
    }
  }

  return {
    campaignId,
    sessionId,
    resource: reactive(resource),
    jobs: reactive(jobs),
    editor: reactive({ form, isSaving, saveError, isEditSessionOpen, openEditSession, saveSession }),
    recording: reactive(recording),
    recap: reactive({ ...recapActions, recap, selectedRecapKind }),
    summary: reactive({
      ...summaryJobs,
      summaryForm,
      summaryDirty: summaryDraft.dirty,
      summarySaving: documents.summarySaving,
      summaryImporting: documents.summaryImporting,
      summaryFile: documents.summaryFile,
      summaryError: documents.summaryError,
      summaryImportError: documents.summaryImportError,
      saveSummary,
      importSummary: documents.importSummary,
    }),
    transcript: reactive({
      transcriptError: documents.transcriptError,
      transcriptDeleteError: documents.transcriptDeleteError,
      transcriptDeleting: documents.transcriptDeleting,
      transcriptImportError: documents.transcriptImportError,
      transcriptImporting: documents.transcriptImporting,
      transcriptFile: documents.transcriptFile,
      saveTranscript: documents.saveTranscript,
      importTranscript: documents.importTranscript,
      deleteTranscript: documents.deleteTranscript,
      showFullTranscript,
      transcriptPreview,
      fullTranscript,
      videoOptions,
      selectedSubtitleRecordingId,
      subtitleAttachLoading,
      subtitleAttachError,
      attachTranscriptToVideo,
    }),
    suggestions: reactive(suggestions),
    overview: reactive({
      sessionDungeonMasterLabel, sessionHeaderDescription, recordingsCount,
      recapStatus, transcriptStatus, summaryStatus, summaryPreview, hasTranscript, hasSummary,
    }),
    navigation: reactive({ sessionNavigationItems, openSessionSection }),
    openPlayer: player.openDrawer,
  }
}
