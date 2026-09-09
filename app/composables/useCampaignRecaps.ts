import type { CampaignRecapItem } from '#shared/types/campaign-overview'
import { sortRecapsByReverseSessionNumber } from '~/utils/recaps'

export const useCampaignRecaps = (
  campaignId: Ref<string>,
  afterRecapMutation?: () => Promise<void>
) => {
  const { request } = useApi()
  const player = useMediaPlayer()

  const { data: recaps, pending: recapsPending, error: recapsError, refresh: refreshRecaps } = useOverviewResource<CampaignRecapItem[]>(campaignId, 'recaps', () => `/api/campaigns/${campaignId.value}/recaps`)

  const selectedRecapId = ref('')
  const recapPlaybackUrl = ref('')
  const recapLoading = ref(false)
  const recapError = ref('')
  const recapDeleting = ref(false)
  const recapDeleteError = ref('')
  const recapsSortedBySessionNumber = computed(() =>
    sortRecapsByReverseSessionNumber(recaps.value)
  )

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Unscheduled'
    return new Date(value).toLocaleString()
  }

  watch(
    () => recapsSortedBySessionNumber.value,
    (value) => {
      if (!value.length) {
        selectedRecapId.value = ''
        return
      }
      if (!selectedRecapId.value || !value.some((item) => item.id === selectedRecapId.value)) {
        selectedRecapId.value = value[0]?.id || ''
      }
    },
    { immediate: true }
  )

  const playRecap = async (recapId: string) => {
    if (recapLoading.value || recapDeleting.value) return
    selectedRecapId.value = recapId
    recapError.value = ''
    recapLoading.value = true
    try {
      const payload = await request<{ url: string }>(`/api/recaps/${recapId}/playback/url`)
      const playbackUrl = payload?.url
      if (!playbackUrl) throw new Error('Unable to load recap playback URL.')
      recapPlaybackUrl.value = playbackUrl
      selectedRecapId.value = recapId
      const recap = recaps.value?.find((item) => item.id === recapId)
      await player.playSource(
        {
          id: recapId,
          recapProgressId: recapId,
          title: recap?.session.title || recap?.filename || 'Session recap',
          subtitle: recap
            ? `Session ${recap.session.sessionNumber ?? '-'} - ${formatDateTime(recap.createdAt)}`
            : undefined,
          kind: recap?.mimeType?.startsWith('video/') ? 'VIDEO' : 'AUDIO',
          src: playbackUrl,
        },
        { presentation: 'global', openDrawer: recap?.mimeType?.startsWith('video/') }
      )
    } catch (error) {
      recapError.value =
        (error as Error & { message?: string }).message || 'Unable to load recap.'
    } finally {
      recapLoading.value = false
    }
  }

  const deleteRecap = async (recapId: string) => {
    if (recapDeleting.value || recapLoading.value) return
    recapDeleteError.value = ''
    recapDeleting.value = true
    try {
      await request(`/api/recaps/${recapId}`, { method: 'DELETE' })
      if (selectedRecapId.value === recapId) recapPlaybackUrl.value = ''
      await refreshRecaps()
      if (afterRecapMutation) {
        await afterRecapMutation()
      }
    } catch (error) {
      recapDeleteError.value =
        (error as Error & { message?: string }).message || 'Unable to delete recap.'
      throw error
    } finally {
      recapDeleting.value = false
    }
  }

  return {
    recaps,
    recapsPending,
    recapsError,
    recapsSortedBySessionNumber,
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
