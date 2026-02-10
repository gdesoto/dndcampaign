import type { Ref } from 'vue'
import type { SessionSummarySuggestion } from '#shared/types/session-workflow'

type UseSessionSuggestionJobsOptions = {
  sessionId: Ref<string>
  summaryDoc: Ref<{ id: string } | null | undefined>
}

export function useSessionSuggestionJobs(options: UseSessionSuggestionJobsOptions) {
  const { request } = useApi()

  const suggestionSending = ref(false)
  const suggestionSendError = ref('')
  const suggestionActionError = ref('')

  const {
    selectedSummaryJobId: selectedSuggestionJobId,
    summaryJob: suggestionJob,
    summarySuggestions: suggestionItems,
    summaryJobHistory: suggestionJobHistory,
    summaryJobOptions: suggestionJobOptions,
    refreshSummaryJob: refreshSuggestionJobs,
    refreshSelectedSummaryJob: refreshSelectedSuggestionJob,
  } = useSummaryJobState({
    sessionId: options.sessionId,
    jobKind: 'SUGGESTION_GENERATION',
    keyPrefix: 'suggestion',
  })

  const sessionSuggestion = computed(() =>
    suggestionItems.value.find((suggestion) => suggestion.entityType === 'SESSION') || null
  )

  const suggestionStatusLabel = computed(() => {
    switch (suggestionJob.value?.status) {
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

  const suggestionStatusColor = computed(() => {
    switch (suggestionJob.value?.status) {
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

  const suggestionGroups = computed(() => {
    const groups: Record<string, SessionSummarySuggestion[]> = {}
    for (const suggestion of suggestionItems.value) {
      const key = suggestion.entityType
      if (!groups[key]) groups[key] = []
      groups[key].push(suggestion)
    }
    return Object.entries(groups).map(([label, items]) => ({ label, items }))
  })

  const generateSuggestions = async () => {
    if (!options.summaryDoc.value) {
      suggestionSendError.value = 'Summary is required before generating suggestions.'
      return
    }
    suggestionSendError.value = ''
    suggestionSending.value = true
    try {
      await request(`/api/sessions/${options.sessionId.value}/suggestion-jobs`, {
        method: 'POST',
        body: {
          summaryDocumentId: options.summaryDoc.value.id,
          mode: 'async',
        },
      })
      await refreshSuggestionJobs()
      await refreshSelectedSuggestionJob()
    } catch (error) {
      suggestionSendError.value =
        (error as Error & { message?: string }).message || 'Unable to generate suggestions.'
    } finally {
      suggestionSending.value = false
    }
  }

  const applySuggestion = async (input: { suggestionId: string; payload: Record<string, unknown> }) => {
    suggestionActionError.value = ''
    try {
      await request(`/api/summary-suggestions/${input.suggestionId}/apply`, {
        method: 'POST',
        body: {
          payload: input.payload,
        },
      })
      await refreshSuggestionJobs()
      await refreshSelectedSuggestionJob()
    } catch (error) {
      suggestionActionError.value =
        (error as Error & { message?: string }).message || 'Unable to apply suggestion.'
    }
  }

  const discardSuggestion = async (suggestionId: string) => {
    suggestionActionError.value = ''
    try {
      await request(`/api/summary-suggestions/${suggestionId}/discard`, {
        method: 'POST',
      })
      await refreshSuggestionJobs()
      await refreshSelectedSuggestionJob()
    } catch (error) {
      suggestionActionError.value =
        (error as Error & { message?: string }).message || 'Unable to discard suggestion.'
    }
  }

  return {
    suggestionSending,
    suggestionSendError,
    suggestionActionError,
    selectedSuggestionJobId,
    suggestionJob,
    suggestionItems,
    suggestionJobHistory,
    suggestionJobOptions,
    sessionSuggestion,
    suggestionStatusLabel,
    suggestionStatusColor,
    suggestionGroups,
    refreshSuggestionJobs,
    generateSuggestions,
    applySuggestion,
    discardSuggestion,
  }
}
