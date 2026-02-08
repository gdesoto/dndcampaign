import type { Ref } from 'vue'

type CampaignNavItem = {
  id: string
  name: string
}

type CampaignOption = {
  label: string
  id: string
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
    const items = (campaigns.value || []).map((campaign) => ({
      label: campaign.name,
      id: campaign.id,
    }))
    return [{ label: 'All campaigns', id: 'all' }, ...items]
  })

  const selectedCampaignId = ref<string>('all')
  const campaignSelectReady = ref(false)

  watch(
    () => campaignId.value,
    (value) => {
      selectedCampaignId.value = value || 'all'
    },
    { immediate: true }
  )

  watch(
    () => campaigns.value,
    (value) => {
      if (!value?.length && selectedCampaignId.value !== 'all') {
        selectedCampaignId.value = 'all'
      }
    }
  )

  watch(
    () => selectedCampaignId.value,
    (value) => {
      if (!campaignSelectReady.value) return
      if (!showCampaignSelect.value) return
      if (!value) return
      const targetPath = resolveCampaignSelectorRoute(route.path, campaignId.value, value)
      if (targetPath === route.path) return
      router.push(targetPath)
    }
  )

  onMounted(() => {
    campaignSelectReady.value = true
  })

  return {
    showCampaignSelect,
    campaignOptions,
    selectedCampaignId,
  }
}
