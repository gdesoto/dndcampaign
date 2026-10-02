import { computed } from 'vue'
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

type MediaPlayerState = {
  source: MediaSource | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
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
    playbackRate: 1,
    presentation: 'global',
    dockId: '',
    drawerOpen: false,
    autoplay: false,
    error: '',
    playToken: 0,
  }))

  const element = useState<HTMLMediaElement | null>(elementKey, () => null)

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
      media.load()
      if (source.startTime !== undefined) media.currentTime = source.startTime
    }
    return true
  }

  const play = async () => {
    const media = element.value
    const source = state.value.source
    if (!media || !source || state.value.autoplay) return
    const retry = Boolean(state.value.error)
    const nextSource = retry ? { ...source, startTime: media.currentTime || source.startTime } : source
    if (!prepareElement(media, nextSource, retry)) return
    const token = ++state.value.playToken
    state.value.error = ''
    state.value.autoplay = true
    try {
      // Native play waits for loading; no separate canplay listener or URL cache is needed.
      await media.play()
      if (token !== state.value.playToken || element.value !== media) return
      state.value.isPlaying = true
    } catch {
      if (token !== state.value.playToken || element.value !== media) return
      state.value.isPlaying = false
      state.value.error = 'Unable to play media. Retry playback.'
    } finally {
      if (token === state.value.playToken && element.value === media) {
        state.value.autoplay = false
      }
    }
  }

  const setElement = (value: HTMLMediaElement | null) => {
    const previous = element.value
    if (previous === value) return
    state.value.playToken += 1
    const shouldPlay = state.value.autoplay
    state.value.autoplay = false
    state.value.isPlaying = false
    element.value = value
    if (previous) releaseElement(previous)
    if (!value) return
    value.volume = state.value.volume
    value.playbackRate = state.value.playbackRate
    const source = state.value.source
    if (source) prepareElement(value, source)
    if (shouldPlay) void play()
  }

  const selectSource = (source: MediaSource) => {
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
    const media = element.value
    if (media && !prepareElement(media, source, changed)) releaseElement(media)
  }

  const playSource = async (
    source: MediaSource,
    options?: { presentation?: MediaPresentation; openDrawer?: boolean }
  ) => {
    selectSource(source)
    if (options?.presentation) state.value.presentation = options.presentation
    if (options?.openDrawer) state.value.drawerOpen = true
    const media = element.value
    if (!media || media.tagName !== (source.kind === 'VIDEO' ? 'VIDEO' : 'AUDIO')) {
      // The global component mounts the matching element and starts this selection.
      state.value.autoplay = true
      return
    }
    if (source.startTime !== undefined) media.currentTime = source.startTime
    await play()
  }

  const pause = () => {
    state.value.playToken += 1
    state.value.autoplay = false
    state.value.isPlaying = false
    element.value?.pause()
  }

  const stop = () => {
    state.value.playToken += 1
    state.value.autoplay = false
    state.value.source = null
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

  const seek = (time: number) => {
    const media = element.value
    if (!media) return
    const duration = Number.isFinite(media.duration) ? media.duration : 0
    const nextTime = Math.max(0, Math.min(time, duration || time))
    media.currentTime = nextTime
    state.value.currentTime = nextTime
  }

  const setVolume = (value: number) => {
    const nextValue = Math.max(0, Math.min(value, 1))
    state.value.volume = nextValue
    if (element.value) element.value.volume = nextValue
  }

  const setPlaybackRate = (value: number) => {
    const nextValue = Math.max(0.5, Math.min(value, 3))
    state.value.playbackRate = nextValue
    if (element.value) element.value.playbackRate = nextValue
  }

  const loadSource = (
    source: MediaSource,
    options?: { presentation?: MediaPresentation }
  ) => {
    selectSource(source)
    if (options?.presentation) state.value.presentation = options.presentation
  }

  const setPresentation = (value: MediaPresentation) => {
    state.value.presentation = value
    if (value === 'page') {
      state.value.drawerOpen = false
    }
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

  return {
    state,
    element,
    hasSource,
    setElement,
    playSource,
    loadSource,
    play,
    pause,
    stop,
    toggle,
    seek,
    setVolume,
    setPlaybackRate,
    setPresentation,
    setDockId,
    openDrawer,
    closeDrawer,
  }
}
