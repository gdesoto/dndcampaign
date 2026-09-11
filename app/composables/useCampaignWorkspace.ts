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

  // Session context changes must not tear down the campaign's nested NuxtPage
  // while the destination route is still resolving its async setup.
  const campaignShell = useRetainedResource<Pick<CampaignWorkspace, 'campaign' | 'access'>>(
    () => options.campaignId.value,
  )
  watch(workspace, (value) => {
    if (value?.campaign.id === options.campaignId.value) campaignShell.seed(value)
  }, { immediate: true, flush: 'sync' })

  const currentWorkspace = computed(() =>
    workspace.value?.campaign.id === options.campaignId.value ? workspace.value : undefined,
  )
  const campaign = computed(() => currentWorkspace.value?.campaign || campaignShell.get()?.campaign)
  const sessionHeader = computed(() =>
    options.isSessionDetailRoute.value && currentWorkspace.value?.sessionHeader?.id === options.sessionId.value
      ? currentWorkspace.value.sessionHeader
      : null,
  )
  const access = computed(() => currentWorkspace.value?.access || campaignShell.get()?.access)
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
