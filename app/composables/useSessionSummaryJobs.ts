import type { Ref } from 'vue'
import type {
  SessionSummaryJob,
  SessionSummarySuggestion,
  SessionSummaryJobResponse,
} from '#shared/types/session-workflow'

type UseSessionSummaryJobsOptions = {
  sessionId: Ref<string>
  transcriptDoc: Ref<{ id: string } | null | undefined>
  refreshSummary: () => Promise<void>
}

export function useSessionSummaryJobs(options: UseSessionSummaryJobsOptions) {
  const { request } = useApi()

  const summarySending = ref(false)
  const summarySendError = ref('')
  const summaryActionError = ref('')
  const selectedSummaryJobId = ref('')

  const { data: summaryJobData, refresh: refreshSummaryJob } = useAsyncData(
    () => `summary-job-${options.sessionId.value}`,
    () => request<SessionSummaryJobResponse>(`/api/sessions/${options.sessionId.value}/summary-jobs`)
  )

  const { data: selectedSummaryJobData, refresh: refreshSelectedSummaryJob } = useAsyncData(
    () => `summary-job-detail-${selectedSummaryJobId.value || 'latest'}`,
    () => {
      if (!selectedSummaryJobId.value) return Promise.resolve(null)
      return request<SessionSummaryJob & { suggestions: SessionSummarySuggestion[] }>(
        `/api/summary-jobs/${selectedSummaryJobId.value}`
      )
    },
    { immediate: false }
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
    const groups: Record<string, SessionSummarySuggestion[]> = {}
    for (const suggestion of summarySuggestions.value) {
      const key = suggestion.entityType
      if (!groups[key]) groups[key] = []
      groups[key].push(suggestion)
    }
    return Object.entries(groups).map(([label, items]) => ({ label, items }))
  })

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

  const applyPendingSummary = async () => {
    if (!summaryJob.value?.id) return
    summaryActionError.value = ''
    try {
      await request(`/api/summary-jobs/${summaryJob.value.id}/apply-summary`, {
        method: 'POST',
      })
      await options.refreshSummary()
      await refreshSummaryJob()
      await refreshSelectedSummaryJob()
    } catch (error) {
      summaryActionError.value =
        (error as Error & { message?: string }).message || 'Unable to apply summary.'
    }
  }

  return {
    summarySending,
    summarySendError,
    summaryActionError,
    selectedSummaryJobId,
    summaryJob,
    summarySuggestions,
    summaryJobHistory,
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
  }
}
