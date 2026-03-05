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

  const selectedSummaryJobId = useState<string>(
    `${options.keyPrefix}-selected-summary-job-${options.sessionId.value}`,
    () => ''
  )
  const summaryJobData = useState<SessionSummaryJobResponse | null>(
    `${options.keyPrefix}-summary-job-data-${options.sessionId.value}`,
    () => null
  )
  const selectedSummaryJobData = useState<SessionSummaryJobDetail | null>(
    `${options.keyPrefix}-summary-job-detail-${options.sessionId.value}`,
    () => null
  )

  const refreshSummaryJob = async () => {
    summaryJobData.value = await request<SessionSummaryJobResponse>(
      `/api/sessions/${options.sessionId.value}/summaries/jobs`
    )
  }

  const refreshSelectedSummaryJob = async () => {
    if (!selectedSummaryJobId.value) {
      selectedSummaryJobData.value = null
      return
    }
    selectedSummaryJobData.value = await request<SessionSummaryJobDetail>(
      `/api/summaries/jobs/${selectedSummaryJobId.value}`
    )
  }

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
      if (!value) {
        selectedSummaryJobData.value = null
        return
      }
      await refreshSelectedSummaryJob()
    },
    { immediate: true }
  )

  if (!summaryJobData.value) {
    void refreshSummaryJob()
  }

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
