type CampaignRecapItem = {
  id: string
  filename: string
  createdAt: string
  session: {
    id: string
    title: string
    sessionNumber?: number | null
    playedAt?: string | null
  }
}

export const useCampaignRecaps = (campaignId: Ref<string>) => {
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
        selectedRecapId.value = value[0].id
      }
    },
    { immediate: true }
  )

  const playRecap = async (recapId: string) => {
    recapError.value = ''
    recapLoading.value = true
    try {
      const payload = await request<{ url: string }>(`/api/recaps/${recapId}/playback-url`)
      recapPlaybackUrl.value = payload.url
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
          src: payload.url,
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
    try {
      await request(`/api/recaps/${recapId}`, { method: 'DELETE' })
      if (selectedRecapId.value === recapId) {
        recapPlaybackUrl.value = ''
        selectedRecapId.value = ''
      }
      await refreshRecaps()
    } catch (error) {
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
