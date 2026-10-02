import type { CampaignRecapItem } from '#shared/types/campaign-overview'
import { sortRecapsByReverseSessionNumber } from '~/utils/recaps'
import { artifactStreamUrl } from '~/utils/artifact'

export const useCampaignRecaps = (
  campaignId: Ref<string>,
  afterRecapMutation?: () => Promise<void>
) => {
  const { request } = useApi()
  const player = useMediaPlayer()

  const { data: recaps, pending: recapsPending, error: recapsError, refresh: refreshRecaps } = useOverviewResource<CampaignRecapItem[]>(campaignId, 'recaps', () => `/api/campaigns/${campaignId.value}/recaps`)

  const selectedRecapId = ref('')
  const recapDeleting = ref(false)
  const recapDeleteError = ref('')
  const recapsSortedBySessionNumber = computed(() =>
    sortRecapsByReverseSessionNumber(recaps.value)
  )
  const selectedRecap = computed(() => recaps.value?.find(item => item.id === selectedRecapId.value))
  const activeRecap = computed(() => {
    const recap = selectedRecap.value
    const source = player.state.value.source
    return Boolean(recap && source?.id === recap.id && source.src === artifactStreamUrl(recap.artifactId)
      && source.kind === (recap.mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO'))
  })
  const isRecapPlaying = computed(() => activeRecap.value && player.state.value.isPlaying)
  const recapLoading = computed(() => activeRecap.value && player.state.value.autoplay)
  const recapError = computed(() => activeRecap.value ? player.state.value.error : '')

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

  const playRecap = (recapId: string) => {
    if (recapLoading.value || recapDeleting.value) return
    const recap = recaps.value?.find(item => item.id === recapId)
    if (!recap) return
    const kind = recap.mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO'
    selectedRecapId.value = recapId
    return player.playSource(
      {
        id: recapId,
        recapProgressId: recapId,
        title: recap.session.title || recap.filename || 'Session recap',
        subtitle: `Session ${recap.session.sessionNumber ?? '-'} - ${formatDateTime(recap.createdAt)}`,
        kind,
        src: artifactStreamUrl(recap.artifactId),
      },
      { presentation: 'global', openDrawer: kind === 'VIDEO' }
    )
  }

  const deleteRecap = async (recapId: string) => {
    if (recapDeleting.value || recapLoading.value) return
    const recap = recaps.value?.find(item => item.id === recapId)
    const src = recap ? artifactStreamUrl(recap.artifactId) : undefined
    const kind = recap?.mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO'
    recapDeleteError.value = ''
    recapDeleting.value = true
    try {
      await request(`/api/recaps/${recapId}`, { method: 'DELETE' })
      const source = player.state.value.source
      if (source?.id === recapId && source.src === src && source.kind === kind) player.stop()
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
    isRecapPlaying,
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
