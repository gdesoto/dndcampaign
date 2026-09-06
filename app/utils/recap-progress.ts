type RecapProgress = { position: number; updatedAt: number }
const key = (id: string) => `dmvault-recap-progress-v1:${id}`

export const readRecapProgress = (id: string): RecapProgress | null => {
  try {
    const value = JSON.parse(localStorage.getItem(key(id)) || 'null')
    return value && Number.isFinite(value.position) && value.position >= 0
      && Number.isFinite(value.updatedAt) ? value : null
  } catch {
    return null
  }
}

const bindings = new WeakMap<HTMLMediaElement, () => void>()

export const releaseRecapProgress = (media: HTMLMediaElement) => {
  bindings.get(media)?.()
  bindings.delete(media)
}

// Bind to a specific recap, so delayed events cannot save another recap's position.
export function trackRecapProgress(media: HTMLMediaElement, id?: string, startTime?: number) {
  releaseRecapProgress(media)
  if (!id) return
  const saved = readRecapProgress(id)
  let restored = false
  let played = false
  const restore = () => {
    if (restored) return
    const position = startTime ?? saved?.position ?? 0
    media.currentTime = Number.isFinite(media.duration) && position >= media.duration ? 0 : position
    restored = true
  }
  const save = () => {
    if (!restored || !played || !Number.isFinite(media.currentTime)) return
    try {
      localStorage.setItem(key(id), JSON.stringify({
        position: media.ended ? 0 : media.currentTime,
        updatedAt: Date.now(),
      }))
    } catch {
      // Storage may be disabled or full; playback must remain available.
    }
  }
  const onPlay = () => { played = true; save() }
  const onVisibility = () => { if (document.visibilityState === 'hidden') save() }
  media.addEventListener('loadedmetadata', restore)
  media.addEventListener('play', onPlay)
  const events = ['timeupdate', 'pause', 'seeked', 'ended'] as const
  events.forEach(event => media.addEventListener(event, save))
  window.addEventListener('pagehide', save)
  document.addEventListener('visibilitychange', onVisibility)
  bindings.set(media, () => {
    save()
    media.removeEventListener('loadedmetadata', restore)
    media.removeEventListener('play', onPlay)
    events.forEach(event => media.removeEventListener(event, save))
    window.removeEventListener('pagehide', save)
    document.removeEventListener('visibilitychange', onVisibility)
  })
}

