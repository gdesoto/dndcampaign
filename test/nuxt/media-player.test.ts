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
  fire(media, 'playing')
  return Promise.resolve()
}
const loadFailure = (media: HTMLMediaElement) => {
  Object.defineProperty(media, 'error', { configurable: true, value: { code: 4, message: 'Unable to load media.' } })
  fire(media, 'error')
}
const visibleAlert = () => document.querySelector('[role="alert"]')?.textContent
  || document.querySelector('video-neutral-skin, audio-neutral-skin')?.shadowRoot?.querySelector('media-error-dialog')?.textContent
const clickRetry = async () => {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button[aria-label="Retry playback"]')]
    .find(button => !button.disabled)
  expect(button).toBeDefined()
  button!.click()
  await flushPromises()
}

beforeEach(async () => {
  clearNuxtState(['media-player-state', 'media-player-element', 'media-player-controller', 'media-player-queue'])
  localStorage.clear()
  nativeLoad = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function (this: HTMLMediaElement) {
    this.currentTime = 0
    this.playbackRate = this.defaultPlaybackRate
    Object.defineProperty(this, 'ended', { configurable: true, value: false })
    Object.defineProperty(this, 'error', { configurable: true, value: null })
    Object.defineProperty(this, 'duration', { configurable: true, value: 300 })
    fire(this, 'emptied')
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
  clearNuxtState(['media-player-state', 'media-player-element', 'media-player-controller', 'media-player-queue'])
  vi.restoreAllMocks()
})

describe('global media playback', () => {
  it('continues a mixed recap queue outside the watch page, honors the switch, and cancels stale resolutions', async () => {
    player.queue.value = {
      key: '/campaigns/c1', ids: ['recap-1', 'recap-2', 'recap-3'], autoAdvance: true,
      resolve: id => source({ id, recapProgressId: id, kind: id === 'recap-2' ? 'VIDEO' : 'AUDIO', src: `/api/artifacts/${id}/stream` }),
    }
    await player.playSource(source())
    await flushPromises()
    const audio = mountedMedia()
    player.setPresentation('global')
    Object.defineProperty(audio, 'ended', { configurable: true, value: true })
    fire(audio, 'ended')
    await flushPromises()
    expect(player.state.value.source).toMatchObject({ id: 'recap-2', kind: 'VIDEO', startTime: 0 })
    expect(mountedMedia().tagName).toBe('VIDEO')
    expect(player.state.value.isPlaying).toBe(true)
    player.loadSource(source({ id: 'unrelated-editor', src: '/other.mp3' }), { presentation: 'page' })
    expect(player.state.value.source?.id).toBe('recap-2')
    expect(player.state.value.presentation).toBe('global')
    expect(player.hasPrevious.value).toBe(true)
    player.queue.value!.autoAdvance = false
    Object.defineProperty(mountedMedia(), 'ended', { configurable: true, value: true })
    fire(mountedMedia(), 'ended')
    await flushPromises()
    expect(player.state.value.source?.id).toBe('recap-2')

    const resolveNext = player.queue.value!.resolve
    player.queue.value!.resolve = () => { throw new Error('Offline') }
    await player.moveInQueue(1)
    expect(player.state.value.error).toContain('Retry playback')
    player.queue.value!.resolve = resolveNext
    await player.play()
    await flushPromises()
    expect(player.state.value.source?.id).toBe('recap-3')
    expect(player.state.value.error).toBe('')

    let finish!: (source: MediaSource) => void
    player.queue.value!.resolve = () => new Promise(resolve => { finish = resolve })
    const advance = player.moveInQueue(-1)
    player.stop()
    finish(source({ id: 'recap-3' }))
    await advance
    expect(player.state.value.source).toBeNull()
    expect(player.queue.value).toBeNull()
  })

  it('reuses a relative stream URL, replaces artifacts and media kinds, and retains recap progress and controls', async () => {
    // Empty element attachment must not cancel a pending public playback lookup.
    expect(player.state.value.playToken).toBe(tokenBeforeInitialMount)
    await player.playSource(source(), { presentation: 'global' })
    await flushPromises()
    player.controller.value!.store.setVolume(0.6)
    player.controller.value!.store.setMuted(true)
    player.controller.value!.store.setPlaybackRate(1.5)
    fire(mountedMedia(), 'volumechange')
    fire(mountedMedia(), 'ratechange')
    await flushPromises()
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
    expect(video.muted).toBe(true)
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
    await player.playSource(source())
    await flushPromises()
    player.pause()
    nativePlay.mockClear()
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
    await finishPlay(mountedMedia())
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
    expect(player.state.value.source).toBeNull()
  })

  it.each(['AUDIO', 'VIDEO'] as const)('shows %s load/play failures and retries from mini, inline, and drawer controls', async kind => {
    await player.playSource(source({ kind }))
    await flushPromises()
    const media = mountedMedia()
    loadFailure(media)
    await flushPromises()
    expect(visibleAlert()).toContain('Unable to load media')
    fire(media, 'volumechange')
    await flushPromises()
    expect(player.state.value.isPlaying).toBe(false)
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
    // Native media failures are presented by the skin, without a second app alert.
    expect(document.querySelectorAll('#media-player-drawer-target [role="alert"]')).toHaveLength(0)
    await clickRetry()
    expect(player.state.value.error).toBe('')
    expect(player.state.value.isPlaying).toBe(true)
  })
})
