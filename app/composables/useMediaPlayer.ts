import { computed } from 'vue'
import type { VideoPlayerElement } from '@videojs/html/video'
import { releaseRecapProgress, trackRecapProgress } from '~/utils/recap-progress'

export type MediaKind = 'AUDIO' | 'VIDEO'

export type MediaSource = {
  id: string
  title: string
  subtitle?: string
  kind: MediaKind
  src: string
  recapProgressId?: string
  startTime?: number
  vttUrl?: string
}

type MediaPresentation = 'global' | 'page'

export type MediaQueue = {
  key: string
  ids: string[]
  resolve: (id: string) => MediaSource | Promise<MediaSource>
  autoAdvance: boolean
  retryDirection?: -1 | 1
}

type MediaPlayerState = {
  source: MediaSource | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  playbackRate: number
  presentation: MediaPresentation
  dockId: string
  drawerOpen: boolean
  autoplay: boolean
  error: string
  playToken: number
}

const stateKey = 'media-player-state'
const elementKey = 'media-player-element'

export const useMediaPlayer = () => {
  const state = useState<MediaPlayerState>(stateKey, () => ({
    source: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    playbackRate: 1,
    presentation: 'global',
    dockId: '',
    drawerOpen: false,
    autoplay: false,
    error: '',
    playToken: 0,
  }))

  const element = useState<HTMLMediaElement | null>(elementKey, () => null)
  const controller = useState<VideoPlayerElement | null>('media-player-controller', () => null)
  // Created only by mounted playlist views; never serialized into the SSR payload.
  const queue = useState<MediaQueue | null>('media-player-queue', () => null)
  const queueIndex = computed(() => queue.value?.ids.indexOf(state.value.source?.id || '') ?? -1)
  const hasPrevious = computed(() => queueIndex.value > 0)
  const hasNext = computed(() => queueIndex.value >= 0 && queueIndex.value < (queue.value?.ids.length || 0) - 1)

  const hasSource = computed(() => Boolean(state.value.source))

  const matchesSource = (source: MediaSource) => {
    const current = state.value.source
    return current?.id === source.id && current.src === source.src && current.kind === source.kind
  }

  const releaseElement = (media: HTMLMediaElement) => {
    releaseRecapProgress(media)
    media.pause()
    media.removeAttribute('src')
    media.load()
  }

  const prepareElement = (media: HTMLMediaElement, source: MediaSource, reload = false) => {
    if (media.tagName !== (source.kind === 'VIDEO' ? 'VIDEO' : 'AUDIO')) return false
    // getAttribute preserves our relative URL; media.src resolves it to an absolute URL.
    if (reload || media.getAttribute('src') !== source.src) {
      media.pause()
      trackRecapProgress(media, source.recapProgressId, source.startTime)
      media.src = source.src
      // load() restores playbackRate from defaultPlaybackRate.
      media.defaultPlaybackRate = state.value.playbackRate
      media.load()
      if (source.startTime !== undefined) media.currentTime = source.startTime
    }
    return true
  }

  const failPlayback = (message = 'Unable to load media. Retry playback.') => {
    state.value.autoplay = false
    state.value.isPlaying = false
    state.value.error = message
  }

  const play = async (): Promise<void> => {
    if (state.value.error && queue.value?.retryDirection) return moveInQueue(queue.value.retryDirection)
    const media = element.value
    const source = state.value.source
    if (!media || !source || state.value.autoplay) return
    const retry = Boolean(state.value.error)
    const nextSource = retry ? { ...source, startTime: media.currentTime || source.startTime } : source
    const token = ++state.value.playToken
    state.value.error = ''
    state.value.autoplay = true
    try {
      if (!prepareElement(media, nextSource, retry)) return
      // Native play waits for loading; no separate canplay listener or URL cache is needed.
      await controller.value!.store.play()
      if (token !== state.value.playToken || element.value !== media) return
      state.value.isPlaying = !controller.value!.store.paused
    } catch (error) {
      if (token !== state.value.playToken || element.value !== media) return
      if (error instanceof Error && error.name === 'AbortError') return
      failPlayback('Unable to play media. Retry playback.')
    } finally {
      if (token === state.value.playToken && element.value === media) {
        state.value.autoplay = false
      }
    }
  }

  const setElement = (value: HTMLMediaElement | null) => {
    const previous = element.value
    if (previous === value) return
    if (previous) state.value.playToken += 1
    const shouldPlay = state.value.autoplay
    state.value.isPlaying = false
    element.value = value
    try {
      if (previous) releaseElement(previous)
      if (!value) return
      state.value.autoplay = false
      value.volume = state.value.volume
      value.muted = state.value.muted
      value.playbackRate = state.value.playbackRate
      const source = state.value.source
      if (source) prepareElement(value, source)
      if (shouldPlay) void play()
    } catch {
      failPlayback()
    }
  }

  const selectSource = (source: MediaSource) => {
    if (!queue.value?.ids.includes(source.id)) queue.value = null
    const changed = !matchesSource(source)
    if (changed) {
      state.value.playToken += 1
      state.value.autoplay = false
      state.value.error = ''
      state.value.isPlaying = false
      state.value.currentTime = 0
      state.value.duration = 0
    }
    state.value.source = source
    try {
      const media = element.value
      if (media) {
        if (!prepareElement(media, source, changed)) releaseElement(media)
        else if (source.startTime !== undefined) media.currentTime = source.startTime
      }
      return true
    } catch {
      state.value.playToken += 1
      failPlayback()
      return false
    }
  }

  const setPresentation = (value: MediaPresentation) => {
    state.value.presentation = value
    if (value === 'page') state.value.drawerOpen = false
  }

  const playSource = async (
    source: MediaSource,
    options?: { presentation?: MediaPresentation; openDrawer?: boolean }
  ) => {
    if (options?.presentation) setPresentation(options.presentation)
    if (options?.openDrawer) state.value.drawerOpen = true
    if (!selectSource(source)) return
    const media = element.value
    if (!media || media.tagName !== (source.kind === 'VIDEO' ? 'VIDEO' : 'AUDIO')) {
      // The global component mounts the matching element and starts this selection.
      state.value.autoplay = true
      return
    }
    await play()
  }

  const pause = () => {
    state.value.playToken += 1
    state.value.autoplay = false
    state.value.isPlaying = false
    if (controller.value?.store.target) controller.value.store.pause()
  }

  const stop = () => {
    state.value.playToken += 1
    state.value.autoplay = false
    state.value.source = null
    queue.value = null
    if (element.value) releaseElement(element.value)
    state.value.isPlaying = false
    state.value.currentTime = 0
    state.value.duration = 0
    state.value.drawerOpen = false
    state.value.error = ''
  }

  const toggle = async () => {
    if (state.value.isPlaying) {
      pause()
      return
    }
    await play()
  }

  const seek = (time: number, source?: MediaSource) => {
    if (source && !matchesSource(source)) {
      selectSource({ ...source, startTime: Math.max(0, time) })
      return
    }
    const media = element.value
    if (!media) return
    const duration = Number.isFinite(media.duration) ? media.duration : 0
    const nextTime = Math.max(0, Math.min(time, duration || time))
    void controller.value?.store.seek(nextTime).catch(() => failPlayback('Unable to seek media. Retry playback.'))
  }

  const loadSource = (
    source: MediaSource,
    options?: { presentation?: MediaPresentation }
  ) => {
    // Visiting an editor or playlist must not replace an active listening session.
    if (state.value.source && !matchesSource(source) && (state.value.isPlaying || state.value.autoplay)) return
    if (options?.presentation) setPresentation(options.presentation)
    selectSource(source)
  }

  const setDockId = (value: string) => {
    state.value.dockId = value
  }

  const openDrawer = () => {
    state.value.drawerOpen = true
  }

  const closeDrawer = () => {
    state.value.drawerOpen = false
  }

  const moveInQueue = async (direction: -1 | 1): Promise<void> => {
    const currentQueue = queue.value
    const id = currentQueue?.ids[queueIndex.value + direction]
    if (!id || !currentQueue || state.value.autoplay) return
    const token = ++state.value.playToken
    state.value.autoplay = true
    state.value.error = ''
    currentQueue.retryDirection = undefined
    try {
      const source = await currentQueue.resolve(id)
      if (token !== state.value.playToken || queue.value !== currentQueue) return
      state.value.autoplay = false
      await playSource({ ...source, startTime: direction === 1 ? 0 : undefined })
    } catch {
      if (token === state.value.playToken) {
        currentQueue.retryDirection = direction
        failPlayback('Unable to load this recap. Retry playback or choose another recap.')
      }
    } finally {
      if (token === state.value.playToken) state.value.autoplay = false
    }
  }

  const connect = (value: VideoPlayerElement) => {
    controller.value = value
    const store = value.store
    let lastError = store.error
    const sync = () => {
      const media = value.querySelector('video, audio') as HTMLMediaElement | null
      if (!media || store.target?.media !== media) return
      if (element.value !== media) setElement(media)
      if (!state.value.source || media.getAttribute('src') !== state.value.source.src) return
      state.value.currentTime = store.currentTime
      state.value.duration = store.duration
      state.value.isPlaying = !store.paused && !store.ended && !store.error
      state.value.volume = store.volume
      state.value.muted = store.muted
      state.value.playbackRate = store.playbackRate
      if (store.error && store.error !== lastError) {
        state.value.playToken++
        failPlayback(`${store.error.message || 'Unable to load media.'} Retry playback.`)
      }
      lastError = store.error
    }
    // Attachment publishes each feature in turn. Read the completed store,
    // rather than overwriting retained preferences with a half-attached store.
    let scheduled = false
    let connected = true
    const unsubscribe = store.subscribe(() => {
      if (scheduled) return
      scheduled = true
      queueMicrotask(() => {
        scheduled = false
        if (connected) sync()
      })
    })
    sync()
    return () => {
      connected = false
      unsubscribe()
      setElement(null)
      controller.value = null
    }
  }

  return {
    state,
    element,
    controller,
    queue,
    hasPrevious,
    hasNext,
    moveInQueue,
    connect,
    hasSource,
    playSource,
    loadSource,
    play,
    pause,
    stop,
    toggle,
    seek,
    setPresentation,
    setDockId,
    openDrawer,
    closeDrawer,
  }
}
