import { computed } from 'vue'

export type MediaKind = 'AUDIO' | 'VIDEO'

export type MediaSource = {
  id: string
  title: string
  subtitle?: string
  kind: MediaKind
  src: string
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

  let pendingCanPlayListener: { media: HTMLMediaElement; listener: () => void } | null = null

  const clearPendingCanPlayListener = () => {
    if (!pendingCanPlayListener) return
    pendingCanPlayListener.media.removeEventListener('canplay', pendingCanPlayListener.listener)
    pendingCanPlayListener = null
  }

  const setElement = (value: HTMLMediaElement | null) => {
    clearPendingCanPlayListener()
    const previous = element.value
    element.value = value
    if (previous && previous !== value) {
      previous.pause()
      previous.currentTime = 0
      previous.removeAttribute('src')
      previous.load()
    }
    if (!value) return
    value.volume = state.value.volume
    value.playbackRate = state.value.playbackRate
    if (state.value.source) {
      value.pause()
    }
    if (state.value.source && value.src !== state.value.source.src) {
      value.src = state.value.source.src
      value.load()
    }
    if (state.value.autoplay) {
      value
        .play()
        .catch(() => {
          state.value.error = 'Unable to auto-play media.'
        })
        .finally(() => {
          state.value.autoplay = false
        })
    }
  }

  const lastPlay = useState<{ id: string; at: number }>('media-player-last-play', () => ({
    id: '',
    at: 0,
  }))

  const playSource = async (
    source: MediaSource,
    options?: { presentation?: MediaPresentation; openDrawer?: boolean }
  ) => {
    const now = Date.now()
    if (lastPlay.value.id === source.id && now - lastPlay.value.at < 300) {
      return
    }
    lastPlay.value = { id: source.id, at: now }
    state.value.error = ''
    state.value.isPlaying = false
    state.value.source = source
    state.value.playToken += 1
    if (options?.presentation) {
      state.value.presentation = options.presentation
    }
    if (options?.openDrawer) {
      state.value.drawerOpen = true
    }

    const media = element.value
    if (!media) {
      state.value.autoplay = true
      return
    }

    const expectedTag = source.kind === 'VIDEO' ? 'VIDEO' : 'AUDIO'
    if (media.tagName !== expectedTag) {
      // Element will be replaced (audio -> video or video -> audio). Defer play until new element mounts.
      media.pause()
      media.removeAttribute('src')
      media.load()
      state.value.autoplay = true
      return
    }

    if (media.src !== source.src) {
      const token = state.value.playToken
      state.value.autoplay = true
      media.src = source.src
      media.load()
      clearPendingCanPlayListener()
      const onCanPlay = () => {
        clearPendingCanPlayListener()
        if (!state.value.autoplay || token !== state.value.playToken) return
        media
          .play()
          .then(() => {
            state.value.isPlaying = true
          })
          .catch(() => {
            state.value.error = 'Unable to play media.'
          })
          .finally(() => {
            state.value.autoplay = false
          })
      }
      pendingCanPlayListener = { media, listener: onCanPlay }
      media.addEventListener('canplay', onCanPlay)
      return
    }

    try {
      await media.play()
      state.value.isPlaying = true
    } catch (error) {
      state.value.error =
        (error as Error & { message?: string }).message || 'Unable to play media.'
    }
  }

  const play = async () => {
    const media = element.value
    if (!media) return
    try {
      await media.play()
      state.value.isPlaying = true
    } catch (error) {
      state.value.error =
        (error as Error & { message?: string }).message || 'Unable to play media.'
    }
  }

  const pause = () => {
    element.value?.pause()
  }

  const stop = () => {
    clearPendingCanPlayListener()
    if (element.value) {
      element.value.pause()
      element.value.currentTime = 0
    }
    state.value.isPlaying = false
    state.value.currentTime = 0
    state.value.duration = 0
    state.value.source = null
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
