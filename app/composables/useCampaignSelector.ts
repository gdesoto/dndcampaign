import type { Ref } from 'vue'

type CampaignNavItem = {
  id: string
  name: string
}

type CampaignOption = {
  label: string
  id: string
  disabled?: boolean
}

export const useCampaignSelector = (
  route: ReturnType<typeof useRoute>,
  router: ReturnType<typeof useRouter>,
  campaigns: Ref<CampaignNavItem[] | null | undefined>
) => {
  const campaignId = computed(() => route.params.campaignId as string | undefined)
  const showCampaignSelect = computed(() => {
    const path = route.path || ''
    return path === '/campaigns' || path.startsWith('/campaigns/')
  })

  const campaignOptions = computed<CampaignOption[]>(() => {
    const items: CampaignOption[] = (campaigns.value || []).map((campaign) => ({
      label: campaign.name,
      id: campaign.id,
    }))
    if (campaignId.value && !items.some((item) => item.id === campaignId.value)) {
      items.unshift({ label: 'Current campaign', id: campaignId.value, disabled: true })
    }
    return [{ label: 'All campaigns', id: 'all' }, ...items]
  })

  const selectedCampaignId = computed(() => campaignId.value || 'all')

  const selectCampaign = (value: string | undefined) => {
    if (!showCampaignSelect.value || !value || value === selectedCampaignId.value) return
    const targetPath = resolveCampaignSelectorRoute(route.path, campaignId.value, value)
    if (targetPath !== route.path) return router.push(targetPath)
  }

  return {
    showCampaignSelect,
    campaignOptions,
    selectedCampaignId,
    selectCampaign,
  }
}
