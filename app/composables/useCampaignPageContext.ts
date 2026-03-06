import type { ComputedRef } from 'vue'

export const useCampaignPageContext = () => {
  const route = useRoute()
  const campaignId = computed(() => route.params.campaignId as string)
  const { request } = useApi()
  const canWriteContent = inject<ComputedRef<boolean>>(
    'campaignCanWriteContent',
    computed(() => true)
  )

  return {
    route,
    campaignId,
    request,
    canWriteContent,
  }
}
