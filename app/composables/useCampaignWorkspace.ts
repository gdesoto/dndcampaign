import type { Ref } from 'vue'
import type { CampaignWorkspace } from '#shared/types/api/campaign-workspace'

type UseCampaignWorkspaceOptions = {
  campaignId: Ref<string>
  sessionId: Ref<string>
  isSessionDetailRoute: Ref<boolean>
}

export async function useCampaignWorkspace(options: UseCampaignWorkspaceOptions) {
  const { request } = useApi()
  const resourceKey = () => `campaign-workspace-${options.campaignId.value}-${options.isSessionDetailRoute.value ? (options.sessionId.value || 'none') : 'none'}`
  const retained = useRetainedResource<CampaignWorkspace | null>(resourceKey)

  const {
    data: workspace,
    pending,
    error,
    refresh: refreshWorkspace,
  } = await useAsyncData(
    resourceKey,
    () => retained.load(() =>
      request<CampaignWorkspace>(`/api/campaigns/${options.campaignId.value}/workspace`, {
        query: {
          sessionId: options.isSessionDetailRoute.value ? options.sessionId.value : undefined,
        },
      })),
    {
      default: retained.get,
      watch: [options.sessionId, options.isSessionDetailRoute],
    }
  )
  retained.seed(workspace.value)

  const campaign = computed(() => workspace.value?.campaign)
  const sessionHeader = computed(() => workspace.value?.sessionHeader || null)
  const access = computed(() => workspace.value?.access)
  const canWriteContent = computed(() => Boolean(access.value?.permissions.includes('content.write')))
  const refreshCampaign = async () => refreshWorkspace()
  const refreshSessionHeader = async () => refreshWorkspace()

  const refreshAll = async () => {
    await refreshWorkspace()
  }

  return {
    campaign,
    sessionHeader,
    access,
    canWriteContent,
    pending,
    error,
    refreshCampaign,
    refreshSessionHeader,
    refreshAll,
  }
}
