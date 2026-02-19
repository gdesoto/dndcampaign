import type { CampaignRecapItem } from '#shared/types/campaign-overview'

export const useCampaignRecaps = (
  campaignId: Ref<string>,
  afterRecapMutation?: () => Promise<void>
) => {
  const { request } = useApi()
  const player = useMediaPlayer()

  const { data: recaps, refresh: refreshRecaps } = useAsyncData(
    () => `campaign-recaps-${campaignId.value}`,
    () => request<CampaignRecapItem[]>(`/api/campaigns/${campaignId.value}/recaps`)
  )

  const selectedRecapId = ref('')
  const recapPlaybackUrl = ref('')
  const recapLoading = ref(false)
  const recapError = ref('')
  const recapDeleting = ref(false)
  const recapDeleteError = ref('')

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Unscheduled'
    return new Date(value).toLocaleString()
  }

  watch(
    () => recaps.value,
    (value) => {
      if (value?.length && !selectedRecapId.value) {
        selectedRecapId.value = value[0]?.id || ''
      }
    },
    { immediate: true }
  )

  const playRecap = async (recapId: string) => {
    recapError.value = ''
    recapLoading.value = true
    try {
      const payload = await request<{ url: string }>(`/api/recaps/${recapId}/playback-url`)
      const playbackUrl = payload?.url
      if (!playbackUrl) throw new Error('Unable to load recap playback URL.')
      recapPlaybackUrl.value = playbackUrl
      selectedRecapId.value = recapId
      const recap = recaps.value?.find((item) => item.id === recapId)
      await player.playSource(
        {
          id: recapId,
          title: recap?.session.title || recap?.filename || 'Recap audio',
          subtitle: recap
            ? `Session ${recap.session.sessionNumber ?? '-'} - ${formatDateTime(recap.createdAt)}`
            : undefined,
          kind: 'AUDIO',
          src: playbackUrl,
        },
        { presentation: 'global' }
      )
    } catch (error) {
      recapError.value =
        (error as Error & { message?: string }).message || 'Unable to load recap.'
    } finally {
      recapLoading.value = false
    }
  }

  const deleteRecap = async (recapId: string) => {
    recapDeleteError.value = ''
    recapDeleting.value = true
    const previousRecaps = recaps.value ? [...recaps.value] : undefined
    const previousSelectedRecapId = selectedRecapId.value
    const previousPlaybackUrl = recapPlaybackUrl.value

    if (recaps.value) {
      recaps.value = recaps.value.filter((item) => item.id !== recapId)
    }
    if (selectedRecapId.value === recapId) {
      recapPlaybackUrl.value = ''
      selectedRecapId.value = recaps.value?.[0]?.id || ''
    }
    try {
      await request(`/api/recaps/${recapId}`, { method: 'DELETE' })
      await refreshRecaps()
      if (afterRecapMutation) {
        await afterRecapMutation()
      }
    } catch (error) {
      if (previousRecaps) {
        recaps.value = previousRecaps
      }
      selectedRecapId.value = previousSelectedRecapId
      recapPlaybackUrl.value = previousPlaybackUrl
      recapDeleteError.value =
        (error as Error & { message?: string }).message || 'Unable to delete recap.'
    } finally {
      recapDeleting.value = false
    }
  }

  return {
    recaps,
    selectedRecapId,
    recapPlaybackUrl,
    recapLoading,
    recapError,
    recapDeleting,
    recapDeleteError,
    refreshRecaps,
    playRecap,
    deleteRecap,
    openPlayer: () => player.openDrawer(),
  }
}
