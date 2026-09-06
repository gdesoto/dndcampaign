import type { MediaSource } from '~/composables/useMediaPlayer'
import { readRecapProgress } from '~/utils/recap-progress'
import { sortRecapsByReverseSessionNumber } from '~/utils/recaps'

export type WatchRecap = {
  id: string
  filename: string
  mimeType?: string
  createdAt: string
  session: { id: string; title: string; sessionNumber?: number | null; playedAt?: string | null }
}

export const useRecapWatch = (options: {
  recaps: Ref<WatchRecap[] | null | undefined>
  resolvePlayback: (id: string) => Promise<{ url: string } | null>
}) => {
  const route = useRoute()
  const router = useRouter()
  const player = useMediaPlayer()
  const playlist = computed(() => sortRecapsByReverseSessionNumber(options.recaps.value).reverse())
  const selectedId = ref('')
  const selected = computed(() => playlist.value.find(item => item.id === selectedId.value))
  const selectedIndex = computed(() => playlist.value.findIndex(item => item.id === selectedId.value))
  const next = computed(() => playlist.value[selectedIndex.value + 1])
  const previous = computed(() => playlist.value[selectedIndex.value - 1])
  const loading = ref(false)
  const error = ref('')
  const autoAdvance = ref(true)
  let requestToken = 0
  let disposed = false

  const select = async (id: string, autoplay = true, fromStart = false) => {
    const token = ++requestToken
    selectedId.value = id
    error.value = ''
    loading.value = false
    const recap = playlist.value.find(item => item.id === id)
    if (!recap) {
      error.value = 'This recap is no longer available in this playlist. Choose another recap below.'
      return
    }
    loading.value = true
    try {
      if (player.state.value.source?.recapProgressId === id && !fromStart && !player.state.value.error) {
        player.setPresentation('page')
        if (autoplay) await player.play()
      } else {
        const playback = await options.resolvePlayback(id)
        if (disposed || token !== requestToken) return
        if (!playback?.url) throw new Error('Unable to load recap playback.')
        const source: MediaSource = {
          id, recapProgressId: id, title: recap.session.title || recap.filename,
          subtitle: `Session ${recap.session.sessionNumber ?? '-'}`,
          kind: recap.mimeType?.startsWith('video/') ? 'VIDEO' : 'AUDIO',
          src: playback.url,
          startTime: fromStart ? 0 : undefined,
        }
        if (autoplay) await player.playSource(source, { presentation: 'page' })
        else player.loadSource(source, { presentation: 'page' })
      }
    } catch {
      if (token === requestToken && !disposed) error.value = 'Unable to load this recap. Try again or choose another recap.'
    } finally {
      if (token === requestToken && !disposed) loading.value = false
    }
  }

  const choose = async (id: string, fromStart = false) => {
    // Set selection before updating the URL so the route watcher does not load twice.
    const pending = select(id, true, fromStart)
    await router.push({ query: { ...route.query, recap: id } })
    await pending
  }

  const mounted = ref(false)
  onMounted(() => { mounted.value = true })
  watch([mounted, () => route.query.recap, playlist], ([ready, query, items]) => {
    if (!ready || !items.length) return
    const explicit = typeof query === 'string' ? query : ''
    const recent = items.map(item => ({ id: item.id, saved: readRecapProgress(item.id) }))
      .filter(item => item.saved).sort((a, b) => b.saved!.updatedAt - a.saved!.updatedAt)[0]
    const id = explicit || recent?.id || items[0]!.id
    if (id !== selectedId.value) void select(id, false)
  }, { immediate: true })

  const onEnded = () => {
    if (!disposed && !loading.value && autoAdvance.value && next.value
      && player.state.value.presentation === 'page'
      && player.state.value.source?.recapProgressId === selectedId.value) {
      void choose(next.value.id, true)
    }
  }
  watch(player.element, (element, _, onCleanup) => {
    element?.addEventListener('ended', onEnded)
    onCleanup(() => element?.removeEventListener('ended', onEnded))
  }, { immediate: true, flush: 'sync' })
  onBeforeUnmount(() => { disposed = true; requestToken++ })

  return { player, playlist, selected, selectedId, selectedIndex, next, previous, loading, error, autoAdvance, choose, select }
}
