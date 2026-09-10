import type { Ref } from 'vue'
import type { SessionSummaryJobResponse } from '#shared/types/session-workflow'

/** One combined jobs resource owned by the session parent. */
export function useSessionJobs(sessionId: Ref<string>) {
  const { request } = useApi()
  const key = () => `session-jobs-${sessionId.value}`
  const retained = useRetainedResource<SessionSummaryJobResponse | null>(key)
  const { data, pending, error, refresh: reload } = useAsyncData(
    key,
    () => retained.load(() => request<SessionSummaryJobResponse>(`/api/sessions/${sessionId.value}/summaries/jobs`)),
    { default: retained.get },
  )
  retained.seed(data.value)
  const refresh = async () => {
    await reload()
    if (error.value) throw error.value
  }
  return { sessionId, data, pending, error, refresh }
}
