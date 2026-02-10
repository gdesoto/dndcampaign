import type { Ref } from 'vue'
import type {
  SessionSummaryJobDetail,
  SessionSummaryJobResponse,
  SessionSummarySuggestion,
} from '#shared/types/session-workflow'

type UseSummaryJobStateOptions = {
  sessionId: Ref<string>
  jobKind: 'SUMMARY_GENERATION' | 'SUGGESTION_GENERATION'
  keyPrefix: string
}

export function useSummaryJobState(options: UseSummaryJobStateOptions) {
  const { request } = useApi()

  const selectedSummaryJobId = ref('')

  const { data: summaryJobData, refresh: refreshSummaryJob } = useAsyncData(
    () => `${options.keyPrefix}-summary-job-${options.sessionId.value}`,
    () => request<SessionSummaryJobResponse>(`/api/sessions/${options.sessionId.value}/summary-jobs`)
  )

  const { data: selectedSummaryJobData, refresh: refreshSelectedSummaryJob } = useAsyncData(
    () => `${options.keyPrefix}-summary-job-detail-${selectedSummaryJobId.value || 'latest'}`,
    () => {
      if (!selectedSummaryJobId.value) return Promise.resolve(null)
      return request<SessionSummaryJobDetail>(`/api/summary-jobs/${selectedSummaryJobId.value}`)
    },
    { immediate: false }
  )

  const defaultJobForKind = computed(() => {
    if (options.jobKind === 'SUMMARY_GENERATION') {
      return summaryJobData.value?.latestSummaryJob || null
    }
    return summaryJobData.value?.latestSuggestionJob || null
  })

  const summaryJob = computed(() => {
    if (selectedSummaryJobId.value && selectedSummaryJobData.value) {
      return selectedSummaryJobData.value
    }
    return defaultJobForKind.value
  })

  const summarySuggestions = computed<SessionSummarySuggestion[]>(() => {
    if (selectedSummaryJobId.value && selectedSummaryJobData.value) {
      return selectedSummaryJobData.value.suggestions || []
    }
    if (options.jobKind === 'SUMMARY_GENERATION') {
      return summaryJobData.value?.latestSummarySuggestions || []
    }
    return summaryJobData.value?.latestSuggestionSuggestions || []
  })

  const summaryJobHistory = computed(() =>
    (summaryJobData.value?.jobs || []).filter((job) => job.kind === options.jobKind)
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
    () => defaultJobForKind.value?.id,
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

  return {
    selectedSummaryJobId,
    summaryJob,
    summarySuggestions,
    summaryJobHistory,
    summaryJobOptions,
    refreshSummaryJob,
    refreshSelectedSummaryJob,
  }
}
