import type { Ref } from 'vue'
import type {
  SessionWorkspace,
} from '#shared/types/api/session-workspace'

type UseSessionWorkspaceOptions = {
  sessionId: Ref<string>
}

export async function useSessionWorkspace(options: UseSessionWorkspaceOptions) {
  const { request } = useApi()

  const {
    data: workspace,
    pending,
    error,
    refresh: refreshWorkspace,
  } = await useAsyncData(
    () => `session-workspace-${options.sessionId.value}`,
    () => request<SessionWorkspace>(`/api/sessions/${options.sessionId.value}/workspace`)
  )

  const session = computed(() => workspace.value?.session)
  const recordings = computed(() => workspace.value?.recordings)
  const recap = computed(() => workspace.value?.recap)
  const transcriptDoc = computed(() => workspace.value?.transcriptDoc)
  const summaryDoc = computed(() => workspace.value?.summaryDoc)

  const refreshSession = async () => refreshWorkspace()
  const refreshRecordings = async () => refreshWorkspace()
  const refreshRecap = async () => refreshWorkspace()
  const refreshTranscript = async () => refreshWorkspace()
  const refreshSummary = async () => refreshWorkspace()

  const refreshAll = async () => {
    await refreshWorkspace()
  }

  return {
    session,
    recordings,
    recap,
    transcriptDoc,
    summaryDoc,
    pending,
    error,
    refreshSession,
    refreshRecordings,
    refreshRecap,
    refreshTranscript,
    refreshSummary,
    refreshAll,
  }
}
