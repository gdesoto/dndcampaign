import type { useMediaPlayer } from './useMediaPlayer'

// One owner at the app root; unsupported system actions must never block playback.
export const useMediaSession = (player: ReturnType<typeof useMediaPlayer>) => {
  if (!import.meta.client || !('mediaSession' in navigator)) return
  const session = navigator.mediaSession
  const actions: MediaSessionAction[] = ['play', 'pause', 'stop', 'seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack']
  const setAction = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try { session.setActionHandler(action, handler) } catch { /* Not every browser supports every action. */ }
  }
  watch([() => player.state.value.source, player.hasPrevious, player.hasNext], ([source]) => {
    if (!source) {
      session.metadata = null
      session.playbackState = 'none'
      actions.forEach(action => setAction(action, null))
      try { session.setPositionState?.() } catch { /* Position reporting is optional. */ }
      return
    }
    if ('MediaMetadata' in window) session.metadata = new MediaMetadata({
      title: source.title, artist: source.subtitle || '', album: 'DM Vault',
      artwork: [{ src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' }],
    })
    setAction('play', () => { void player.play() })
    setAction('pause', player.pause)
    setAction('stop', player.stop)
    setAction('seekbackward', details => player.seek(player.state.value.currentTime - (details.seekOffset ?? 10)))
    setAction('seekforward', details => player.seek(player.state.value.currentTime + (details.seekOffset ?? 10)))
    setAction('seekto', details => { if (details.seekTime !== undefined) player.seek(details.seekTime) })
    setAction('previoustrack', player.hasPrevious.value ? () => { void player.moveInQueue(-1) } : null)
    setAction('nexttrack', player.hasNext.value ? () => { void player.moveInQueue(1) } : null)
  }, { immediate: true })
  watch(() => [player.state.value.isPlaying, player.state.value.currentTime, player.state.value.duration, player.state.value.playbackRate] as const, ([playing, position, duration, playbackRate]) => {
    session.playbackState = player.state.value.source ? playing ? 'playing' : 'paused' : 'none'
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return
    try {
      session.setPositionState?.({ duration, position: Math.max(0, Math.min(position, duration)), playbackRate })
    } catch { /* Some platforms expose Media Session without position-state support. */ }
  })
  onBeforeUnmount(() => {
    actions.forEach(action => setAction(action, null))
    session.metadata = null
    session.playbackState = 'none'
  })
}
