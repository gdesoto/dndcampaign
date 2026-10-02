import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { clearNuxtState, useNuxtApp } from '#app'
import { UApp } from '#components'
import GlobalMediaPlayer from '../../app/components/GlobalMediaPlayer.vue'
import { useMediaPlayer, type MediaSource } from '../../app/composables/useMediaPlayer'
import { readRecapProgress } from '../../app/utils/recap-progress'

const deferred = () => {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const fire = (media: HTMLMediaElement, name: string) => media.dispatchEvent(new Event(name))
const source = (overrides: Partial<MediaSource> = {}): MediaSource => ({
  id: 'recap-1', title: 'Session recap', kind: 'AUDIO',
  src: '/api/artifacts/artifact-1/stream', recapProgressId: 'recap-1', ...overrides,
})

let wrapper: VueWrapper | undefined
let host: HTMLDivElement
let player: ReturnType<typeof useMediaPlayer>
let secondPlayer: ReturnType<typeof useMediaPlayer>
let tokenBeforeInitialMount: number
let nativePlay: MockInstance<HTMLMediaElement['play']>
let nativeLoad: MockInstance<HTMLMediaElement['load']>

const mountedMedia = () => player.element.value!
const finishPlay = (media: HTMLMediaElement) => {
  Object.defineProperty(media, 'paused', { configurable: true, value: false })
  fire(media, 'play')
  return Promise.resolve()
}
const loadFailure = (media: HTMLMediaElement) => {
  Object.defineProperty(media, 'error', { configurable: true, value: { code: 4 } })
  fire(media, 'error')
}
const visibleAlert = () => document.querySelector('[role="alert"]')?.textContent
const clickRetry = async () => {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button[aria-label="Retry playback"]')]
    .find(button => !button.disabled)
  expect(button).toBeDefined()
  button!.click()
  await flushPromises()
}

beforeEach(async () => {
  clearNuxtState(['media-player-state', 'media-player-element'])
  localStorage.clear()
  nativeLoad = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function (this: HTMLMediaElement) {
    this.currentTime = 0
    Object.defineProperty(this, 'error', { configurable: true, value: null })
    Object.defineProperty(this, 'duration', { configurable: true, value: 300 })
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { configurable: true, value: true })
    fire(this, 'pause')
  })
  nativePlay = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    return finishPlay(this)
  })
  host = document.createElement('div')
  host.innerHTML = '<div id="global-media-player-host"></div><div id="test-media-dock"></div>'
  document.body.append(host)
  wrapper = await mountSuspended(defineComponent({
    setup() {
      player = useMediaPlayer()
      tokenBeforeInitialMount = player.state.value.playToken
      return () => h(UApp, null, { default: () => h(GlobalMediaPlayer) })
    },
  }), {
    attachTo: host,
    global: {
      stubs: {
        // The player owns its controls/teleport; only the drawer's animation is omitted.
        UDrawer: defineComponent({
          props: { open: Boolean },
          setup: (props, { slots }) => () => props.open ? h('section', slots.content?.()) : null,
        }),
      },
    },
  })
  secondPlayer = await useNuxtApp().runWithContext(() => useMediaPlayer())
})

afterEach(async () => {
  player.stop()
  await nextTick()
  wrapper?.unmount()
  await flushPromises()
  wrapper = undefined
  host.remove()
  clearNuxtState(['media-player-state', 'media-player-element'])
  vi.restoreAllMocks()
})

describe('global media playback', () => {
  it('reuses a relative stream URL, replaces artifacts and media kinds, and retains recap progress and controls', async () => {
    // Empty element attachment must not cancel a pending public playback lookup.
    expect(player.state.value.playToken).toBe(tokenBeforeInitialMount)
    player.setVolume(0.6)
    player.setPlaybackRate(1.5)
    await player.playSource(source(), { presentation: 'global' })
    const audio = mountedMedia()
    fire(audio, 'loadedmetadata')
    audio.currentTime = 42
    fire(audio, 'timeupdate')
    player.pause()
    await secondPlayer.playSource(source())
    expect(nativeLoad).toHaveBeenCalledTimes(1)
    expect(audio.currentTime).toBe(42)
    expect(player.state.value.isPlaying).toBe(true)

    await player.playSource(source({ src: '/api/artifacts/replacement/stream' }))
    expect(nativeLoad).toHaveBeenCalledTimes(2)
    expect(readRecapProgress('recap-1')?.position).toBe(42)
    fire(audio, 'loadedmetadata')
    expect(audio.currentTime).toBe(42)

    await player.playSource(source({ kind: 'VIDEO', src: '/api/artifacts/video/stream', vttUrl: '/captions.vtt' }), { openDrawer: true })
    await flushPromises()
    const video = mountedMedia()
    expect(video.tagName).toBe('VIDEO')
    expect(video).not.toBe(audio)
    expect(video.volume).toBe(0.6)
    expect(video.playbackRate).toBe(1.5)
    expect(video.querySelector('track')?.getAttribute('src')).toBe('/captions.vtt')
    fire(video, 'loadedmetadata')
    expect(video.currentTime).toBe(42)
    loadFailure(audio)
    expect(player.state.value.error).toBe('')
    expect(player.state.value.drawerOpen).toBe(true)

    // Timed recording playback works without recap persistence, including a kind switch.
    await player.playSource(source({ id: 'recording', recapProgressId: undefined, startTime: 17 }))
    await flushPromises()
    expect(mountedMedia().tagName).toBe('AUDIO')
    expect(mountedMedia().currentTime).toBe(17)
    const loads = nativeLoad.mock.calls.length
    await player.playSource(source({ id: 'recording', recapProgressId: undefined, startTime: 27 }))
    expect(mountedMedia().currentTime).toBe(27)
    expect(nativeLoad).toHaveBeenCalledTimes(loads)
    mountedMedia().currentTime = 31
    fire(mountedMedia(), 'timeupdate')
    loadFailure(mountedMedia())
    await player.play()
    expect(mountedMedia().currentTime).toBe(31)
  })

  it('deduplicates concurrent plays across callers and ignores old completion after replacement, pause, or stop', async () => {
    const first = deferred()
    const replacement = deferred()
    nativePlay.mockReturnValueOnce(first.promise).mockReturnValueOnce(replacement.promise)
    const oldPlay = player.playSource(source())
    await secondPlayer.playSource(source())
    expect(nativePlay).toHaveBeenCalledTimes(1)
    expect(player.state.value.autoplay).toBe(true)

    const nextPlay = secondPlayer.playSource(source({ src: '/api/artifacts/replacement/stream' }))
    first.reject(new Error('old stream failed'))
    await oldPlay
    expect(player.state.value.error).toBe('')
    expect(player.state.value.autoplay).toBe(true)
    expect(player.state.value.isPlaying).toBe(false)
    replacement.resolve()
    await nextPlay
    expect(player.state.value.isPlaying).toBe(true)

    const paused = deferred()
    nativePlay.mockReturnValueOnce(paused.promise)
    const pausedPlay = player.playSource(source({ id: 'other', src: '/api/artifacts/other/stream' }))
    secondPlayer.pause()
    paused.resolve()
    await pausedPlay
    expect(player.state.value.isPlaying).toBe(false)

    const stopped = deferred()
    nativePlay.mockReturnValueOnce(stopped.promise)
    const stoppedPlay = player.playSource(source())
    secondPlayer.stop()
    stopped.reject(new Error('stopped stream failed'))
    await stoppedPlay
    expect(player.state.value).toMatchObject({ source: null, error: '', isPlaying: false, autoplay: false })
    expect(mountedMedia().getAttribute('src')).toBeNull()
  })

  it.each(['AUDIO', 'VIDEO'] as const)('shows %s load/play failures and retries from mini, inline, and drawer controls', async kind => {
    await player.playSource(source({ kind }))
    await flushPromises()
    const media = mountedMedia()
    loadFailure(media)
    await nextTick()
    expect(visibleAlert()).toContain('Unable to load media')
    const beforeRetry = nativeLoad.mock.calls.length
    await clickRetry()
    expect(nativeLoad).toHaveBeenCalledTimes(beforeRetry + 1)
    expect(player.state.value).toMatchObject({ error: '', isPlaying: true, autoplay: false })

    nativeLoad.mockImplementationOnce(() => { throw new DOMException('Media setup failed') })
    await expect(player.playSource(source({ kind, src: '/api/artifacts/setup-retry/stream' }))).resolves.toBeUndefined()
    await nextTick()
    expect(visibleAlert()).toContain('Unable to load media')
    expect(player.state.value).toMatchObject({ isPlaying: false, autoplay: false })
    await clickRetry()
    expect(player.state.value).toMatchObject({ error: '', isPlaying: true, autoplay: false })

    player.pause()
    player.setDockId('test-media-dock')
    player.setPresentation('page')
    nativePlay.mockRejectedValueOnce(new Error('NotAllowedError'))
    const rejectedPlay = player.play()
    const resolvingToken = player.state.value.playToken
    await rejectedPlay
    // Settling this play must not cancel a newer public playback lookup.
    expect(player.state.value.playToken).toBe(resolvingToken)
    await nextTick()
    expect(document.querySelector('#test-media-dock [role="alert"]')?.textContent).toContain('Unable to play media')
    await clickRetry()
    expect(player.state.value.error).toBe('')

    player.setPresentation('global')
    player.openDrawer()
    await flushPromises()
    const pending = deferred()
    nativePlay.mockReturnValueOnce(pending.promise)
    const attempt = player.play()
    loadFailure(media)
    pending.resolve()
    await attempt
    await nextTick()
    expect(visibleAlert()).toContain('Unable to load media')
    expect(player.state.value.isPlaying).toBe(false)
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1)
    await clickRetry()
    expect(player.state.value.error).toBe('')
    expect(player.state.value.isPlaying).toBe(true)
  })
})
