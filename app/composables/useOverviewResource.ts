/** Overview requests retain successful data without sharing incompatible async-data options with other pages. */
export const useOverviewResource = <T>(campaignId: Ref<string>, section: string, path: () => string) => {
  const { request } = useApi()
  const retained = useRetainedResource<T>(() => campaignId.value)
  const resource = useAsyncData(
    () => `overview-${section}-${campaignId.value}`,
    () => retained.load(async () => {
      const data = await request<T>(path())
      if (data == null) throw new Error('This resource is unavailable.')
      return data
    }),
    { default: retained.get },
  )
  // There is no pick/transform here; Nuxt's generic PickFrom resolves to the full T.
  watch(resource.data as Ref<T | undefined>, retained.seed, { immediate: true })
  return resource
}
