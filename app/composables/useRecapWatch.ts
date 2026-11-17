import type { MediaSource } from '~/composables/useMediaPlayer'
import { readRecapProgress } from '~/utils/recap-progress'
import { sortRecapsByReverseSessionNumber } from '~/utils/recaps'
import { artifactStreamUrl } from '~/utils/artifact'

export type WatchRecap = {
  id: string
  artifactId?: string
  filename: string
  mimeType?: string
  createdAt: string
  session: { id: string; title: string; sessionNumber?: number | null; playedAt?: string | null }
}

export type ResolveRecapPlayback = (id: string) => { url: string } | null | Promise<{ url: string } | null>

const sameRecap = (left: WatchRecap | undefined, right: WatchRecap | undefined) =>
  left?.id === right?.id && left?.artifactId === right?.artifactId && left?.mimeType === right?.mimeType

const sameSource = (left: MediaSource | null, right: MediaSource | null) =>
  Boolean(left && right && left.id === right.id && left.src === right.src && left.kind === right.kind)

export const useRecapWatch = (options: {
  recaps: Ref<WatchRecap[] | null | undefined>
  resolvePlayback: ResolveRecapPlayback
  queueKey: string
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
  const resolving = ref(false)
  const error = ref('')
  const pendingAutoAdvance = ref(true)
  const autoAdvance = computed({
    get: () => player.queue.value?.key === options.queueKey ? player.queue.value.autoAdvance : pendingAutoAdvance.value,
    set: (value: boolean) => {
      pendingAutoAdvance.value = value
      if (player.queue.value?.key === options.queueKey) player.queue.value.autoAdvance = value
    },
  })
  const resolvedPlayback = shallowRef<{ recap: WatchRecap; source: MediaSource } | null>(null)
  let requestedRecap: WatchRecap | undefined
  const active = computed(() => Boolean(selected.value) && sameRecap(selected.value, resolvedPlayback.value?.recap)
    && sameSource(resolvedPlayback.value?.source || null, player.state.value.source))
  const loading = computed(() => resolving.value || (active.value && player.state.value.autoplay))
  let requestToken = 0
  let disposed = false

  const select = async (id: string, autoplay = true, fromStart = false) => {
    const token = ++requestToken
    selectedId.value = id
    error.value = ''
    resolving.value = false
    const item = playlist.value.find(item => item.id === id)
    const recap = item ? { ...item } : undefined
    requestedRecap = recap
    if (!recap) {
      resolvedPlayback.value = null
      error.value = 'This recap is no longer available in this playlist. Choose another recap below.'
      return
    }
    const isCurrent = () => !disposed && token === requestToken
      && sameRecap(recap, playlist.value.find(item => item.id === id))
    const playerToken = player.state.value.playToken
    resolving.value = true
    try {
      const result = options.resolvePlayback(id)
      const playback = result instanceof Promise ? await result : result
      if (!isCurrent() || playerToken !== player.state.value.playToken) return
      if (!playback?.url) throw new Error('Unable to load recap playback.')
      const source: MediaSource = {
        id, recapProgressId: id, title: recap.session.title || recap.filename,
        subtitle: `Session ${recap.session.sessionNumber ?? '-'}`,
        kind: recap.mimeType?.startsWith('video/') ? 'VIDEO' : 'AUDIO',
        src: playback.url,
        startTime: fromStart ? 0 : undefined,
      }
      resolvedPlayback.value = { recap, source }
      const items = [...playlist.value]
      const resolvePlayback = options.resolvePlayback
      const nextQueue = {
        key: options.queueKey,
        ids: items.map(item => item.id),
        autoAdvance: autoAdvance.value,
        resolve: async (id: string): Promise<MediaSource> => {
          const nextRecap = items.find(item => item.id === id)
          // Nuxt disposes the watch page's async data after navigation. Private
          // items already carry their stream identity; retain that queue snapshot.
          const nextPlayback = nextRecap?.artifactId
            ? { url: artifactStreamUrl(nextRecap.artifactId) }
            : await resolvePlayback(id)
          if (!nextRecap || !nextPlayback?.url) throw new Error('Recap is no longer available.')
          return {
            id, recapProgressId: id, title: nextRecap.session.title || nextRecap.filename,
            subtitle: `Session ${nextRecap.session.sessionNumber ?? '-'}`,
            kind: nextRecap.mimeType?.startsWith('video/') ? 'VIDEO' : 'AUDIO',
            src: nextPlayback.url,
          }
        },
      }
      if (autoplay) {
        player.queue.value = nextQueue
        return player.playSource(source, { presentation: 'page' })
      }
      player.loadSource(source, { presentation: 'page' })
      if (sameSource(source, player.state.value.source)) player.queue.value = nextQueue
    } catch {
      if (isCurrent() && playerToken === player.state.value.playToken) error.value = 'Unable to load this recap. Try again or choose another recap.'
    } finally {
      if (isCurrent()) resolving.value = false
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
  watch([mounted, () => route.query.recap, () => playlist.value.map(item => [item.id, item.artifactId, item.mimeType])], ([ready, query]) => {
    if (!ready) return
    const items = playlist.value
    const explicit = typeof query === 'string' ? query : ''
    const recent = items.map(item => ({ id: item.id, saved: readRecapProgress(item.id) }))
      .filter(item => item.saved).sort((a, b) => b.saved!.updatedAt - a.saved!.updatedAt)[0]
    const playingId = player.queue.value?.key === options.queueKey ? player.state.value.source?.id : undefined
    const id = explicit || playingId || recent?.id || items[0]?.id || selectedId.value
    const recap = items.find(item => item.id === id)
    if (id !== selectedId.value || !sameRecap(recap, requestedRecap)) {
      if (!sameRecap(items.find(item => item.id === selectedId.value), requestedRecap)
        && player.state.value.presentation === 'page' && sameSource(resolvedPlayback.value?.source || null, player.state.value.source)) {
        player.stop()
      }
      void select(id, false)
    }
  }, { immediate: true })

  // The global player advances even after this view unmounts. Keep its visible
  // selection and share URL in sync only while the playlist view is mounted.
  watch(() => player.state.value.source, (source) => {
    if (!source || player.queue.value?.key !== options.queueKey) return
    const recap = playlist.value.find(item => item.id === source.id)
    if (!recap || source.id === selectedId.value) return
    selectedId.value = source.id
    requestedRecap = recap
    resolvedPlayback.value = { recap, source }
    void router.replace({ query: { ...route.query, recap: source.id } })
  })
  onBeforeUnmount(() => { disposed = true; requestToken++ })

  return { player, playlist, selected, selectedId, selectedIndex, next, previous, loading, error, active, autoAdvance, choose, select }
}
