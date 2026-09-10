import type { Ref } from 'vue'

type UseSessionSummaryJobsOptions = {
  jobs: ReturnType<typeof useSessionJobs>
  sessionId: Ref<string>
  transcriptDoc: Ref<{ id: string } | null | undefined>
  refreshSummary: () => Promise<void>
}

export function useSessionSummaryJobs(options: UseSessionSummaryJobsOptions) {
  const { request } = useApi()

  const summarySending = ref(false)
  const summarySendError = ref('')
  const summaryActionError = ref('')
  const {
    loadError,
    statusLabel: summaryStatusLabel,
    statusColor: summaryStatusColor,
    selectedSummaryJobId,
    summaryJob,
    summaryJobHistory,
    summaryJobOptions,
    refreshSummaryJob,
  } = useSummaryJobState({
    jobs: options.jobs,
    jobKind: 'SUMMARY_GENERATION',
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

  const sendSummaryToN8n = async () => {
    if (!options.transcriptDoc.value) {
      summarySendError.value = 'Transcript is required to generate a summary.'
      return
    }
    summarySendError.value = ''
    summarySending.value = true
    try {
      await request(`/api/documents/${options.transcriptDoc.value.id}/summarize`, {
        method: 'POST',
        body: {
          mode: 'async',
        },
      })
      await refreshSummaryJob()
      await options.refreshSummary()
    } catch (error) {
      summarySendError.value =
        (error as Error & { message?: string }).message || 'Unable to send summary to n8n.'
    } finally {
      summarySending.value = false
    }
  }

  const applyPendingSummary = async () => {
    if (!summaryJob.value?.id) return
    summaryActionError.value = ''
    try {
      await request(`/api/summaries/jobs/${summaryJob.value.id}`, {
        method: 'PATCH',
        body: { action: 'apply' },
      })
      await options.refreshSummary()
      await refreshSummaryJob()
    } catch (error) {
      summaryActionError.value =
        (error as Error & { message?: string }).message || 'Unable to apply summary.'
    }
  }

  return {
    summarySending,
    summarySendError,
    summaryActionError: computed(() => summaryActionError.value || loadError.value?.message || ''),
    selectedSummaryJobId,
    summaryJob,
    summaryJobHistory,
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
  }
}
