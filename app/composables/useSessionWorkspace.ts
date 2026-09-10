import type { Ref } from 'vue'
import type {
  SessionWorkspace,
} from '#shared/types/api/session-workspace'

type UseSessionWorkspaceOptions = {
  sessionId: Ref<string>
}

export async function useSessionWorkspace(options: UseSessionWorkspaceOptions) {
  const { request } = useApi()
  const resourceKey = () => `session-workspace-${options.sessionId.value}`
  const retained = useRetainedResource<SessionWorkspace | null>(resourceKey)

  const {
    data: workspace,
    pending,
    error,
    refresh: refreshWorkspace,
  } = await useAsyncData(
    resourceKey,
    () => retained.load(() => request<SessionWorkspace>(`/api/sessions/${options.sessionId.value}/workspace`)),
    { default: retained.get }
  )
  retained.seed(workspace.value)

  const session = computed(() => workspace.value?.session)
  const recordings = computed(() => workspace.value?.recordings)
  const recaps = computed(() => workspace.value?.recaps ?? [])
  const transcriptDoc = computed(() => workspace.value?.transcriptDoc)
  const summaryDoc = computed(() => workspace.value?.summaryDoc)
  const access = computed(() => workspace.value?.access)
  const canWriteContent = computed(() => Boolean(access.value?.permissions.includes('content.write')))
  const canRunSummary = computed(() => Boolean(access.value?.permissions.includes('summary.run')))
  const canUploadRecording = computed(() => Boolean(access.value?.permissions.includes('recording.upload')))

  return {
    session,
    recordings,
    recaps,
    transcriptDoc,
    summaryDoc,
    access,
    canWriteContent,
    canRunSummary,
    canUploadRecording,
    pending,
    error,
    refreshWorkspace,
  }
}
