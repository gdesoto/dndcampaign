import type { Ref } from 'vue'
import type { CampaignWorkspace } from '#shared/types/api/campaign-workspace'

type UseCampaignWorkspaceOptions = {
  campaignId: Ref<string>
  sessionId: Ref<string>
  isSessionDetailRoute: Ref<boolean>
}

export async function useCampaignWorkspace(options: UseCampaignWorkspaceOptions) {
  const { request } = useApi()

  const {
    data: workspace,
    pending,
    error,
    refresh: refreshWorkspace,
  } = await useAsyncData(
    () => `campaign-workspace-${options.campaignId.value}-${options.isSessionDetailRoute.value ? (options.sessionId.value || 'none') : 'none'}`,
    () =>
      request<CampaignWorkspace>(`/api/campaigns/${options.campaignId.value}/workspace`, {
        query: {
          sessionId: options.isSessionDetailRoute.value ? options.sessionId.value : undefined,
        },
      }),
    {
      watch: [options.sessionId, options.isSessionDetailRoute],
    }
  )

  const campaign = computed(() => workspace.value?.campaign)
  const sessionHeader = computed(() => workspace.value?.sessionHeader || null)
  const refreshCampaign = async () => refreshWorkspace()
  const refreshSessionHeader = async () => refreshWorkspace()

  const refreshAll = async () => {
    await refreshWorkspace()
  }

  return {
    campaign,
    sessionHeader,
    pending,
    error,
    refreshCampaign,
    refreshSessionHeader,
    refreshAll,
  }
}
