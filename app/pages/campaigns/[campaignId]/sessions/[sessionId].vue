<script setup lang="ts">
import type { TimelineItem } from '@nuxt/ui'
import {
  isSegmentedTranscript,
  parseTranscriptSegments,
  segmentsToPlainText,
} from '#shared/utils/transcript'
definePageMeta({ layout: 'app' })

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const sessionId = computed(() => route.params.sessionId as string)
const { request } = useApi()
const player = useMediaPlayer()

const {
  session,
  recordings,
  recap,
  transcriptDoc,
  summaryDoc,
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

useSeoMeta({
  title: () => {
    if (!session.value) return `Session details | Campaign ${campaignId.value} | DM Vault`
    const label = session.value.sessionNumber
      ? `Session ${session.value.sessionNumber}`
      : 'Session'
    return `${label}: ${session.value.title} | DM Vault`
  },
  description: () => {
    if (!session.value?.notes) return 'Manage recordings, transcript, summary, and recap for this session.'
    return session.value.notes.slice(0, 160)
  },
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

const workflowStepOrder = ['details', 'recordings', 'transcription', 'summary', 'recap'] as const
type WorkflowStep = (typeof workflowStepOrder)[number]
const sessionSectionOrder = ['overview', ...workflowStepOrder] as const
type SessionSection = (typeof sessionSectionOrder)[number]

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
  uploadRecording,
  loadPlayback,
} = useSessionRecordings({
  sessionId,
  recordings,
  refreshRecordings: sessionInvalidation.afterRecordingsMutation,
})

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
} = useSessionRecap({
  sessionId,
  recap,
  refreshRecap: sessionInvalidation.afterRecapMutation,
})

const {
  summarySending,
  summarySendError,
  summaryActionError,
  selectedSummaryJobId,
  summaryJob,
  sessionSuggestion,
  summaryJobOptions,
  summaryHighlights,
  summaryPendingText,
  summarySessionTags,
  summaryNotableDialogue,
  summaryConcreteFacts,
  summaryStatusLabel,
  summaryStatusColor,
  summarySuggestionGroups,
  refreshSummaryJob,
  sendSummaryToN8n,
  applySummarySuggestion,
  discardSummarySuggestion,
  applyPendingSummary,
} = useSessionSummaryJobs({
  sessionId,
  transcriptDoc,
  refreshSummary: sessionInvalidation.afterSummaryMutation,
})

const transcriptContent = toRef(transcriptForm, 'content')
const summaryContent = toRef(summaryForm, 'content')

const {
  transcriptSaving,
  summarySaving,
  transcriptError,
  summaryError,
  transcriptImportError,
  summaryImportError,
  transcriptImporting,
  summaryImporting,
  transcriptFile,
  summaryFile,
  saveTranscript,
  saveSummary,
  importTranscript,
  importSummary,
} = useSessionDocuments({
  sessionId,
  sessionTitle: computed(() => session.value?.title),
  transcriptDoc,
  summaryDoc,
  transcriptContent,
  summaryContent,
  refreshTranscript: sessionInvalidation.afterTranscriptMutation,
  refreshSummary: sessionInvalidation.afterSummaryMutation,
})

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

const recordingsCount = computed(() => recordings.value?.length || 0)
const recapStatus = computed(() => (recap.value ? 'Attached' : 'Missing'))
const transcriptStatus = computed(() => (transcriptDoc.value ? 'Available' : 'Missing'))
const summaryStatus = computed(() => (summaryDoc.value ? 'Available' : 'Missing'))
const hasRecordings = computed(() => (recordings.value?.length || 0) > 0)
const hasTranscript = computed(() => Boolean(transcriptDoc.value))
const hasSummary = computed(() => Boolean(summaryDoc.value))
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
    await sessionInvalidation.afterSessionMutation()
    if (isEditSessionOpen.value) isEditSessionOpen.value = false
  } catch (error) {
    saveError.value =
      (error as Error & { message?: string }).message || 'Unable to update session.'
  } finally {
    isSaving.value = false
  }
}

const attachTranscriptToVideo = async () => {
  if (!selectedSubtitleRecordingId.value) return
  subtitleAttachError.value = ''
  subtitleAttachLoading.value = true
  try {
    await request(`/api/recordings/${selectedSubtitleRecordingId.value}/vtt/from-transcript`, {
      method: 'POST',
    })
    await sessionInvalidation.afterRecordingsMutation()
  } catch (error) {
    subtitleAttachError.value =
      (error as Error & { message?: string }).message || 'Unable to attach subtitles.'
  } finally {
    subtitleAttachLoading.value = false
  }
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
      <UButton class="mt-4" variant="outline" @click="refreshSession">Try again</UButton>
    </UCard>

    <div v-else class="space-y-6">
      <div class="space-y-6">
        <SessionWorkflowTimeline
          :active-step="currentSection"
          :items="sessionNavigationItems"
          @update:active-step="openSessionSection"
          @step-selected="openSessionSection"
        />

        <NuxtPage
          :campaign-id="campaignId"
          :form="form"
          :is-saving="isSaving"
          :save-error="saveError"
          :session-dungeon-master-label="sessionDungeonMasterLabel"
          :transcript-preview="transcriptPreview"
          :summary-preview="summaryPreview"
          :recordings-count="recordingsCount"
          :transcript-status="transcriptStatus"
          :summary-status="summaryStatus"
          :recap-status="recapStatus"
          :transcript-doc-id="transcriptDoc?.id"
          :summary-doc-id="summaryDoc?.id"
          :checklist-items="checklistItems"
          :selected-file="selectedFile"
          :selected-kind="selectedKind"
          :is-uploading="isUploading"
          :upload-error="uploadError"
          :playback-error="playbackError"
          :playback-loading="playbackLoading"
          :playback-urls="playbackUrls"
          :recordings="recordings"
          :transcript-error="transcriptError"
          :transcript-import-error="transcriptImportError"
          :transcript-importing="transcriptImporting"
          :transcript-file="transcriptFile"
          :show-full-transcript="showFullTranscript"
          :full-transcript="fullTranscript"
          :selected-subtitle-recording-id="selectedSubtitleRecordingId"
          :video-options="videoOptions"
          :subtitle-attach-loading="subtitleAttachLoading"
          :subtitle-attach-error="subtitleAttachError"
          :selected-summary-job-id="selectedSummaryJobId"
          :summary-job-options="summaryJobOptions"
          :summary-sending="summarySending"
          :has-transcript="Boolean(transcriptDoc)"
          :summary-status-color="summaryStatusColor"
          :summary-status-label="summaryStatusLabel"
          :summary-tracking-id="summaryJob?.trackingId"
          :summary-pending-text="summaryPendingText"
          :summary-highlights="summaryHighlights"
          :summary-session-tags="summarySessionTags"
          :summary-notable-dialogue="summaryNotableDialogue"
          :summary-concrete-facts="summaryConcreteFacts"
          :summary-suggestion-groups="summarySuggestionGroups"
          :session-suggestion="sessionSuggestion"
          :summary-send-error="summarySendError"
          :summary-action-error="summaryActionError"
          :summary-content="summaryForm.content"
          :summary-saving="summarySaving"
          :summary-file="summaryFile"
          :summary-importing="summaryImporting"
          :summary-error="summaryError"
          :summary-import-error="summaryImportError"
          :recap-file="recapFile"
          :recap-uploading="recapUploading"
          :recap-playback-loading="recapPlaybackLoading"
          :recap-deleting="recapDeleting"
          :recap-playback-url="recapPlaybackUrl"
          :recap-error="recapError"
          :recap-delete-error="recapDeleteError"
          :has-recap="Boolean(recap)"
          @open-edit="isEditSessionOpen = true"
          @update:selected-file="selectedFile = $event"
          @update:selected-kind="selectedKind = $event"
          @upload-recording="uploadRecording"
          @play-recording="loadPlayback"
          @open-player="player.openDrawer"
          @update:transcript-file="transcriptFile = $event"
          @update:show-full-transcript="showFullTranscript = $event"
          @update:selected-subtitle-recording-id="selectedSubtitleRecordingId = $event"
          @create-transcript="saveTranscript"
          @import-transcript="importTranscript"
          @attach-subtitles="attachTranscriptToVideo"
          @update:selected-summary-job-id="selectedSummaryJobId = $event"
          @refresh-jobs="refreshSummaryJob"
          @send-to-n8n="sendSummaryToN8n"
          @apply-pending-summary="applyPendingSummary"
          @apply-suggestion="applySummarySuggestion"
          @discard-suggestion="discardSummarySuggestion"
          @update:summary-content="summaryForm.content = $event"
          @save-summary="saveSummary"
          @update:summary-file="summaryFile = $event"
          @import-summary="importSummary"
          @update:recap-file="recapFile = $event"
          @upload-recap="uploadRecap"
          @play-recap="loadRecapPlayback"
          @delete-recap="deleteRecap"
          @save-session="saveSession"
          @jump-step="openSessionSection"
        />
      </div>
    </div>

    <SessionEditModal
      v-model:open="isEditSessionOpen"
      :form="form"
      :saving="isSaving"
      :error="saveError"
      @save="saveSession"
    />
  </div>
</template>
