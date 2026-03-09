import type { TimelineItem } from '@nuxt/ui'
import {
  isSegmentedTranscript,
  parseTranscriptSegments,
  segmentsToPlainText,
} from '#shared/utils/transcript'

const workflowStepOrder = ['recordings', 'transcription', 'summary', 'suggestions', 'recap'] as const
type WorkflowStep = (typeof workflowStepOrder)[number]
const sessionSectionOrder = ['overview', ...workflowStepOrder] as const
export type SessionSection = (typeof sessionSectionOrder)[number]

export async function useSessionWorkspaceViewModel() {
  const nuxtApp = useNuxtApp()
  const route = useRoute()
  const campaignId = computed(() => route.params.campaignId as string)
  const sessionId = computed(() => route.params.sessionId as string)
  const { request } = useApi()
  const toast = useToast()
  const player = useMediaPlayer()
  const isEditSessionOpen = useState<boolean>(`session-edit-open-${sessionId.value}`, () => false)

  const {
    session,
    recordings,
    recap,
    transcriptDoc,
    summaryDoc,
    access,
    canWriteContent,
    canRunSummary,
    canUploadRecording,
    pending,
    error,
    refreshAll,
    refreshSession,
    refreshRecordings,
    refreshRecap,
    refreshTranscript,
    refreshSummary,
  } = await useSessionWorkspace({
    sessionId,
  })

  const sessionInvalidation = useSessionWorkspaceInvalidation({
    refreshAll,
    refreshSession,
    refreshRecordings,
    refreshRecap,
    refreshTranscript,
    refreshSummary,
  })

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
    { id: 'generate_suggestions', label: 'Suggestions generated from summary', done: false },
    { id: 'review_links', label: 'Suggestions reviewed (apply/discard)', done: false },
    { id: 'send_recap', label: 'Summary sent to ElevenLabs for recap', done: false },
    { id: 'recap_received', label: 'Recap podcast received and saved', done: false },
  ])

  const transcriptForm = reactive({
    content: '',
  })
  const summaryForm = reactive({
    content: '',
  })
  const stepParam = computed(() =>
    typeof route.params.step === 'string' ? route.params.step : ''
  )

  const currentSection = computed<SessionSection>(() =>
    sessionSectionOrder.includes(stepParam.value as SessionSection)
      ? (stepParam.value as SessionSection)
      : 'overview'
  )

  const {
    uploadError,
    isUploading,
    selectedFile,
    selectedKind,
    playbackUrls,
    playbackLoading,
    playbackError,
    deletingRecordingId,
    deleteError: deleteRecordingError,
    uploadRecording,
    loadPlayback,
    deleteRecording,
  } = await nuxtApp.runWithContext(() => useSessionRecordings({
    sessionId,
    recordings,
    refreshRecordings: sessionInvalidation.afterRecordingsMutation,
  }))

  const {
    recapFile,
    recapUploading,
    recapError,
    recapPlaybackUrl,
    recapPlaybackLoading,
    recapDeleting,
    recapDeleteError,
    uploadRecap,
    loadRecapPlayback,
    deleteRecap,
  } = await nuxtApp.runWithContext(() => useSessionRecap({
    sessionId,
    recap,
    refreshRecap: sessionInvalidation.afterRecapMutation,
  }))

  const {
    summarySending,
    summarySendError,
    summaryActionError,
    selectedSummaryJobId,
    summaryJob,
    summaryJobOptions,
    summaryHighlights,
    summaryPendingText,
    summarySessionTags,
    summaryNotableDialogue,
    summaryConcreteFacts,
    summaryStatusLabel,
    summaryStatusColor,
    refreshSummaryJob,
    sendSummaryToN8n,
    applyPendingSummary,
  } = await nuxtApp.runWithContext(() => useSessionSummaryJobs({
    sessionId,
    transcriptDoc,
    refreshSummary: sessionInvalidation.afterSummaryMutation,
  }))

  const {
    suggestionSending,
    suggestionSendError,
    suggestionActionError,
    selectedSuggestionJobId,
    suggestionJob,
    suggestionJobOptions,
    sessionSuggestion,
    suggestionStatusLabel,
    suggestionStatusColor,
    suggestionGroups,
    refreshSuggestionJobs,
    generateSuggestions,
    applySuggestion,
    discardSuggestion,
  } = await nuxtApp.runWithContext(() => useSessionSuggestionJobs({
    sessionId,
    summaryDoc,
  }))

  const transcriptContent = toRef(transcriptForm, 'content')
  const summaryContent = toRef(summaryForm, 'content')

  const {
    summarySaving,
    transcriptError,
    summaryError,
    transcriptImportError,
    summaryImportError,
    transcriptImporting,
    summaryImporting,
    transcriptFile,
    summaryFile,
    transcriptDeleting,
    transcriptDeleteError,
    saveTranscript,
    saveSummary,
    importTranscript,
    importSummary,
    deleteTranscript,
  } = await nuxtApp.runWithContext(() => useSessionDocuments({
    sessionId,
    sessionTitle: computed(() => session.value?.title),
    transcriptDoc,
    summaryDoc,
    transcriptContent,
    summaryContent,
    refreshTranscript: sessionInvalidation.afterTranscriptMutation,
    refreshSummary: sessionInvalidation.afterSummaryMutation,
  }))

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

  const sessionDungeonMasterLabel = computed(() =>
    session.value?.guestDungeonMasterName
    || session.value?.campaign?.dungeonMasterName
    || 'None'
  )
  const sessionHeaderDescription = computed(() => {
    if (!session.value) return 'Manage recordings, transcript, summary, and recap for this session.'
    const details = [
      session.value.sessionNumber ? `Session ${session.value.sessionNumber}` : 'Session',
      session.value.playedAt ? new Date(session.value.playedAt).toLocaleDateString() : 'Unscheduled',
    ]
    return details.join(' • ')
  })

  const recordingsCount = computed(() => recordings.value?.length || 0)
  const recapStatus = computed(() => (recap.value ? 'Attached' : 'Missing'))
  const transcriptStatus = computed(() => (transcriptDoc.value ? 'Available' : 'Missing'))
  const summaryStatus = computed(() => (summaryDoc.value ? 'Available' : 'Missing'))
  const hasRecordings = computed(() => (recordings.value?.length || 0) > 0)
  const hasTranscript = computed(() => Boolean(transcriptDoc.value))
  const hasSummary = computed(() => Boolean(summaryDoc.value))
  const hasSuggestionJob = computed(() => Boolean(suggestionJob.value))
  const hasRecap = computed(() => Boolean(recap.value))
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

  watch(
    () => summaryDoc.value,
    (value) => {
      summaryForm.content = value?.currentVersion?.content || ''
    },
    { immediate: true }
  )

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
      description: hasSummary.value ? 'Generate and review summary' : 'Send to n8n',
      value: 'summary',
      icon: hasSummary.value ? 'i-lucide-check-circle' : 'i-lucide-sparkles',
    },
    {
      title: 'Suggestions',
      description: 'Review suggested updates',
      value: 'suggestions',
      icon: 'i-lucide-git-merge',
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
    if (!canWriteContent.value) return
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
      await sessionInvalidation.afterSessionMutation()
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
      await sessionInvalidation.afterRecordingsMutation()
    } catch (error) {
      subtitleAttachError.value =
        (error as Error & { message?: string }).message || 'Unable to attach subtitles.'
    } finally {
      subtitleAttachLoading.value = false
    }
  }

  return {
    route,
    campaignId,
    sessionId,
    session,
    recordings,
    recap,
    transcriptDoc,
    summaryDoc,
    access,
    canWriteContent,
    canRunSummary,
    canUploadRecording,
    pending,
    error,
    refreshSession,
    form,
    isSaving,
    saveError,
    subtitleAttachLoading,
    subtitleAttachError,
    selectedSubtitleRecordingId,
    showFullTranscript,
    isEditSessionOpen,
    checklistItems,
    transcriptForm,
    summaryForm,
    currentSection,
    uploadError,
    isUploading,
    selectedFile,
    selectedKind,
    playbackUrls,
    playbackLoading,
    playbackError,
    deletingRecordingId,
    deleteRecordingError,
    uploadRecording,
    loadPlayback,
    deleteRecording,
    recapFile,
    recapUploading,
    recapError,
    recapPlaybackUrl,
    recapPlaybackLoading,
    recapDeleting,
    recapDeleteError,
    uploadRecap,
    loadRecapPlayback,
    deleteRecap,
    summarySending,
    summarySendError,
    summaryActionError,
    selectedSummaryJobId,
    summaryJob,
    summaryJobOptions,
    summaryHighlights,
    summaryPendingText,
    summarySessionTags,
    summaryNotableDialogue,
    summaryConcreteFacts,
    summaryStatusLabel,
    summaryStatusColor,
    refreshSummaryJob,
    sendSummaryToN8n,
    applyPendingSummary,
    suggestionSending,
    suggestionSendError,
    suggestionActionError,
    selectedSuggestionJobId,
    suggestionJob,
    suggestionJobOptions,
    sessionSuggestion,
    suggestionStatusLabel,
    suggestionStatusColor,
    suggestionGroups,
    refreshSuggestionJobs,
    generateSuggestions,
    applySuggestion,
    discardSuggestion,
    summarySaving,
    transcriptError,
    summaryError,
    transcriptImportError,
    summaryImportError,
    transcriptImporting,
    summaryImporting,
    transcriptFile,
    summaryFile,
    transcriptDeleting,
    transcriptDeleteError,
    saveTranscript,
    saveSummary,
    importTranscript,
    importSummary,
    deleteTranscript,
    sessionDungeonMasterLabel,
    sessionHeaderDescription,
    recordingsCount,
    recapStatus,
    transcriptStatus,
    summaryStatus,
    hasTranscript,
    hasSummary,
    hasRecap,
    videoOptions,
    transcriptPreview,
    fullTranscript,
    summaryPreview,
    sessionNavigationItems,
    openSessionSection,
    openEditSession,
    saveSession,
    attachTranscriptToVideo,
    openPlayer: player.openDrawer,
  }
}
