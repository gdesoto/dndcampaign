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
  }))

  const element = useState<HTMLMediaElement | null>(elementKey, () => null)

  const hasSource = computed(() => Boolean(state.value.source))

  const setElement = (value: HTMLMediaElement | null) => {
    element.value = value
    if (!value) return
    value.volume = state.value.volume
    value.playbackRate = state.value.playbackRate
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

  const playSource = async (
    source: MediaSource,
    options?: { presentation?: MediaPresentation; openDrawer?: boolean }
  ) => {
    state.value.error = ''
    state.value.source = source
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

    if (media.src !== source.src) {
      state.value.autoplay = true
      media.src = source.src
      media.load()
      const onCanPlay = () => {
        media.removeEventListener('canplay', onCanPlay)
        if (!state.value.autoplay) return
        media
          .play()
          .catch(() => {
            state.value.error = 'Unable to play media.'
          })
          .finally(() => {
            state.value.autoplay = false
          })
      }
      media.addEventListener('canplay', onCanPlay)
      return
    }

    try {
      await media.play()
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
    } catch (error) {
      state.value.error =
        (error as Error & { message?: string }).message || 'Unable to play media.'
    }
  }

  const pause = () => {
    element.value?.pause()
  }

  const stop = () => {
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
