import type {
  SessionSummaryJobDetail,
  SessionSummarySuggestion,
} from '#shared/types/session-workflow'

const jobStatusPresentation: Record<string, { label: string; color: 'warning' | 'primary' | 'success' | 'error' | 'secondary' }> = {
  READY_FOR_REVIEW: { label: 'Ready for review', color: 'warning' },
  PROCESSING: { label: 'Processing', color: 'primary' },
  SENT: { label: 'Sent', color: 'primary' },
  APPLIED: { label: 'Applied', color: 'success' },
  FAILED: { label: 'Failed', color: 'error' },
  QUEUED: { label: 'Queued', color: 'primary' },
}

type UseSummaryJobStateOptions = {
  jobs: ReturnType<typeof useSessionJobs>
  jobKind: 'SUMMARY_GENERATION' | 'SUGGESTION_GENERATION'
}

export function useSummaryJobState(options: UseSummaryJobStateOptions) {
  const { request } = useApi()
  const { jobs } = options
  const keyPrefix = options.jobKind === 'SUMMARY_GENERATION' ? 'summary' : 'suggestion'
  const selectedSummaryJobId = useState<string>(
    `${keyPrefix}-selected-summary-job-${jobs.sessionId.value}`, () => '',
  )
  const defaultJobForKind = computed(() => options.jobKind === 'SUMMARY_GENERATION'
    ? jobs.data.value?.latestSummaryJob : jobs.data.value?.latestSuggestionJob)
  const latestSuggestions = computed(() => options.jobKind === 'SUMMARY_GENERATION'
    ? jobs.data.value?.latestSummarySuggestions : jobs.data.value?.latestSuggestionSuggestions)

  watch(() => defaultJobForKind.value?.id, id => {
    if (!selectedSummaryJobId.value && id) selectedSummaryJobId.value = id
  }, { immediate: true })

  // Wait for the combined resource before deciding whether a selection needs a
  // detail request. The latest job and its suggestions are already in that response.
  const historicalJobId = computed(() => jobs.data.value && selectedSummaryJobId.value !== defaultJobForKind.value?.id
    ? selectedSummaryJobId.value : '')
  const detailKey = () => `session-job-detail-${jobs.sessionId.value}-${keyPrefix}-${historicalJobId.value || 'latest'}`
  const retained = useRetainedResource<SessionSummaryJobDetail | null>(detailKey)
  const detail = useAsyncData(
    detailKey,
    () => retained.load(() => historicalJobId.value
      ? request<SessionSummaryJobDetail>(`/api/summaries/jobs/${historicalJobId.value}`)
      : Promise.resolve(null)),
    { default: retained.get },
  )
  retained.seed(detail.data.value)

  const summaryJob = computed(() => historicalJobId.value
    ? (detail.data.value?.id === historicalJobId.value ? detail.data.value : null)
    : defaultJobForKind.value || null)
  const summarySuggestions = computed<SessionSummarySuggestion[]>(() => historicalJobId.value
    ? detail.data.value?.id === historicalJobId.value ? detail.data.value.suggestions : []
    : latestSuggestions.value || [])
  const loadError = computed(() => historicalJobId.value ? detail.error.value : jobs.error.value)
  const statusPresentation = computed(() => jobStatusPresentation[summaryJob.value?.status ?? ''])
  const statusLabel = computed(() => statusPresentation.value?.label
    ?? (loadError.value ? 'Unavailable' : jobs.pending.value || detail.pending.value ? 'Loading' : 'Not started'))
  const statusColor = computed(() => statusPresentation.value?.color ?? 'secondary')
  const summaryJobHistory = computed(() => (jobs.data.value?.jobs || []).filter(job => job.kind === options.jobKind))
  const summaryJobOptions = computed(() => summaryJobHistory.value.map(job => ({
    label: `${new Date(job.createdAt).toLocaleString()} · ${job.status}`,
    value: job.id,
  })))

  const refreshSummaryJob = async () => {
    const previousHistoricalId = historicalJobId.value
    await jobs.refresh()
    // A newly historical selection reloads through its reactive key. Only an
    // unchanged historical selection needs an explicit refresh after a mutation.
    if (previousHistoricalId && historicalJobId.value === previousHistoricalId) {
      await detail.refresh()
      if (detail.error.value) throw detail.error.value
    }
  }

  return {
    statusLabel, statusColor, loadError,
    selectedSummaryJobId, summaryJob, summarySuggestions,
    summaryJobHistory, summaryJobOptions, refreshSummaryJob,
  }
}
