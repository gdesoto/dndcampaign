export const usePublicCampaignPageContext = async () => {
  const route = useRoute()
  const publicSlug = computed(() => route.params.publicSlug as string)
  const publicCampaign = usePublicCampaign()

  const {
    data: overview,
    pending: overviewPending,
    error: overviewError,
    refresh: refreshOverview,
  } = await useAsyncData(
    () => `public-campaign-overview-${publicSlug.value}`,
    () => publicCampaign.getOverview(publicSlug.value)
  )

  return {
    route,
    publicSlug,
    publicCampaign,
    overview,
    overviewPending,
    overviewError,
    refreshOverview,
  }
}
