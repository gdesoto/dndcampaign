import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { SessionRecapRecording, SessionRecordingItem } from '#shared/types/session-workflow'
import type { MediaSource } from '../../app/composables/useMediaPlayer'
import { useSessionRecap } from '../../app/composables/useSessionRecap'
import { useSessionRecordings } from '../../app/composables/useSessionRecordings'

const { request, playSource, stop } = vi.hoisted(() => ({ request: vi.fn(), playSource: vi.fn(), stop: vi.fn() }))
const playerState = ref({ source: null as MediaSource | null, isPlaying: false, presentation: 'global', error: '' })
mockNuxtImport('useApi', () => () => ({ request }))
mockNuxtImport('useMediaPlayer', () => () => ({ playSource, stop, state: playerState }))

describe('session media playback', () => {
  beforeEach(() => {
    request.mockReset().mockResolvedValue(undefined)
    playerState.value = { source: null, isPlaying: false, presentation: 'global', error: '' }
    playSource.mockReset().mockImplementation(async (source: MediaSource) => {
      playerState.value = { source, isPlaying: false, presentation: 'global', error: '' }
    })
    stop.mockReset().mockImplementation(() => {
      playerState.value.source = null
      playerState.value.isPlaying = false
    })
  })

  it.each([
    ['audio/mpeg', 'AUDIO', false],
    ['video/mp4', 'VIDEO', true],
    ['video/webm', 'VIDEO', true],
  ])('plays %s directly, including repeat plays, and derives the indicator from actual player state', async (mimeType, kind, openDrawer) => {
    let recap!: ReturnType<typeof useSessionRecap>
    const wrapper = await mountSuspended(defineComponent({
      setup() {
        recap = useSessionRecap({
          sessionId: ref('session-1'),
          selectedRecapKind: ref(mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO'),
          recap: ref({ id: 'recap-1', artifactId: 'recap/one', filename: 'recap', mimeType, byteSize: 100, createdAt: '2026-09-06' }),
          refreshRecap: vi.fn(),
        })
        return () => null
      },
    }))
    await recap.loadRecapPlayback()
    await recap.loadRecapPlayback()
    expect(request).not.toHaveBeenCalled()
    expect(playSource).toHaveBeenCalledTimes(2)
    expect(playSource).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'recap-1', recapProgressId: 'recap-1', kind, src: '/api/artifacts/recap%2Fone/stream' }),
      { presentation: 'global', openDrawer },
    )
    expect(recap.recapPlaying.value).toBe(false)
    playerState.value.isPlaying = true
    expect(recap.recapPlaying.value).toBe(true)
    playerState.value.presentation = 'page'
    expect(recap.recapPlaying.value).toBe(false)
    playerState.value.presentation = 'global'
    playerState.value.isPlaying = false
    playerState.value.error = 'Unable to load media. Select it again to retry.'
    expect(recap.recapPlaying.value).toBe(false)
    expect(recap.recapError.value).toBe('') // Media errors remain owned by the player.
    await recap.loadRecapPlayback()
    expect(playSource).toHaveBeenCalledTimes(3)
    expect(request).not.toHaveBeenCalled()
    wrapper.unmount()
    expect(stop).not.toHaveBeenCalled()
  })

  it('keeps pending recap identity stable across kind/replacement changes and deletes only the captured media', async () => {
    const selectedRecapKind = ref<'AUDIO' | 'VIDEO'>('AUDIO')
    const audio = ref<SessionRecapRecording>({ id: 'audio-1', artifactId: 'audio-artifact', filename: 'audio.mp3', mimeType: 'audio/mpeg', byteSize: 100, createdAt: '2026-09-06' })
    const video = ref<SessionRecapRecording | null>({ ...audio.value, id: 'video-1', artifactId: 'video-artifact', filename: 'video.mp4', mimeType: 'video/mp4' })
    const refreshRecap = vi.fn()
    let controls!: ReturnType<typeof useSessionRecap>
    const wrapper = await mountSuspended(defineComponent({
      setup() {
        controls = useSessionRecap({
          sessionId: ref('session-1'), selectedRecapKind,
          recap: computed(() => selectedRecapKind.value === 'AUDIO' ? audio.value : video.value),
          refreshRecap,
        })
        return () => null
      },
    }))
    let rejectPlay!: (error: Error) => void
    playSource.mockImplementationOnce((source: MediaSource) => {
      playerState.value.source = source
      return new Promise((_, reject) => { rejectPlay = reject })
    })
    const playing = controls.loadRecapPlayback()
    controls.recapFile.value = new File(['audio'], 'replacement.mp3', { type: 'audio/mpeg' })
    await controls.loadRecapPlayback()
    await controls.uploadRecap()
    await controls.deleteRecap()
    expect(playSource).toHaveBeenCalledOnce()
    expect(request).not.toHaveBeenCalled()
    expect(controls.recapPlaybackLoading.value).toBe(true)
    selectedRecapKind.value = 'VIDEO'
    await nextTick()
    expect(controls.recapFile.value).toBeNull()
    expect(playerState.value.source).toMatchObject({ id: 'audio-1', kind: 'AUDIO', src: '/api/artifacts/audio-artifact/stream' })
    rejectPlay(new Error('Old audio failure'))
    await playing
    expect(controls.recapError.value).toBe('')
    expect(controls.recapPlaybackLoading.value).toBe(false)
    await controls.loadRecapPlayback()
    expect(playSource).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'video-1', recapProgressId: 'video-1', kind: 'VIDEO', src: '/api/artifacts/video-artifact/stream' }),
      { presentation: 'global', openDrawer: true },
    )
    playerState.value.isPlaying = true
    expect(controls.recapPlaying.value).toBe(true)
    video.value = { ...video.value!, artifactId: 'replacement-artifact' }
    expect(controls.recapPlaying.value).toBe(false)
    await controls.loadRecapPlayback()
    expect(playSource).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'video-1', recapProgressId: 'video-1', src: '/api/artifacts/replacement-artifact/stream' }), expect.anything())

    playSource.mockRejectedValueOnce(new Error('Unable to start playback'))
    await controls.loadRecapPlayback()
    expect(controls.recapError.value).toBe('Unable to start playback')
    await controls.loadRecapPlayback()
    expect(controls.recapError.value).toBe('')
    expect(request).not.toHaveBeenCalled()

    let finishDelete!: () => void
    request.mockImplementationOnce(() => new Promise<void>(resolve => { finishDelete = resolve }))
    const deleting = controls.deleteRecap()
    await controls.loadRecapPlayback()
    expect(controls.recapDeleting.value).toBe(true)
    // A different surface starts a new artifact while the old deletion is pending.
    playerState.value.source = { ...playerState.value.source!, src: '/api/artifacts/newer-artifact/stream' }
    finishDelete()
    await deleting
    expect(stop).not.toHaveBeenCalled()
    expect(playerState.value.source?.src).toBe('/api/artifacts/newer-artifact/stream')
    expect(request).toHaveBeenLastCalledWith('/api/recaps/video-1', { method: 'DELETE' })

    await controls.loadRecapPlayback()
    playerState.value.isPlaying = true
    refreshRecap.mockImplementationOnce(async () => { video.value = null })
    await controls.deleteRecap()
    expect(stop).toHaveBeenCalledOnce()
    expect(playerState.value.source).toBeNull()
    expect(controls.recapPlaying.value).toBe(false)
    const calls = playSource.mock.calls.length
    await controls.loadRecapPlayback()
    expect(playSource).toHaveBeenCalledTimes(calls)
    wrapper.unmount()
  })

  it('plays recordings without a lookup and matches indicators and deletion to the loaded artifact and kind', async () => {
    const recordings = ref<SessionRecordingItem[]>([
      { id: 'r1', artifactId: 'a1', kind: 'AUDIO', filename: 'one.mp3', mimeType: 'audio/mpeg', byteSize: 100, createdAt: '2026-09-06' },
      { id: 'r2', artifactId: 'a2', kind: 'VIDEO', filename: 'two.mp4', mimeType: 'video/mp4', byteSize: 100, createdAt: '2026-09-06' },
    ])
    const refreshRecordings = vi.fn()
    let controls!: ReturnType<typeof useSessionRecordings>
    const wrapper = await mountSuspended(defineComponent({
      setup() {
        controls = useSessionRecordings({ sessionId: ref('s1'), recordings, refreshRecordings })
        return () => null
      },
    }))
    let finishPlay!: () => void
    playSource.mockImplementationOnce((source: MediaSource) => {
      playerState.value.source = source
      return new Promise<void>((resolve) => { finishPlay = resolve })
    })
    const playing = controls.loadPlayback('r1')
    await controls.loadPlayback('r1')
    await controls.deleteRecording('r1')
    expect(playSource).toHaveBeenCalledOnce()
    expect(request).not.toHaveBeenCalled()
    expect(controls.playbackLoading.r1).toBe(true)
    expect(controls.playingRecordingId.value).toBe('')
    playerState.value.isPlaying = true
    expect(controls.playingRecordingId.value).toBe('r1')
    recordings.value[0]!.artifactId = 'new-a1'
    expect(playerState.value.source?.src).toBe('/api/artifacts/a1/stream')
    expect(controls.playingRecordingId.value).toBe('')
    finishPlay()
    await playing
    expect(controls.playbackLoading.r1).toBe(false)
    await controls.loadPlayback('r1')
    expect(playSource).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'r1', kind: 'AUDIO', src: '/api/artifacts/new-a1/stream' }), { presentation: 'global' })
    await controls.loadPlayback('r2')
    expect(playSource).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'r2', kind: 'VIDEO', src: '/api/artifacts/a2/stream' }), { presentation: 'global' })
    playerState.value.isPlaying = true
    expect(controls.playingRecordingId.value).toBe('r2')
    playerState.value.source!.kind = 'AUDIO'
    expect(controls.playingRecordingId.value).toBe('')
    await controls.loadPlayback('r2')
    playerState.value.isPlaying = false
    playerState.value.error = 'Unable to load media. Select it again to retry.'
    expect(controls.playingRecordingId.value).toBe('')
    await controls.loadPlayback('r2')
    expect(request).not.toHaveBeenCalled()
    playSource.mockRejectedValueOnce(new Error('Playback start failed'))
    await controls.loadPlayback('r2')
    expect(controls.playbackError.value).toBe('Playback start failed')
    await controls.loadPlayback('r2')
    expect(controls.playbackError.value).toBe('')

    let finishDelete!: () => void
    request.mockImplementationOnce(() => new Promise<void>(resolve => { finishDelete = resolve }))
    const deleting = controls.deleteRecording('r2')
    const callsBeforeDelete = playSource.mock.calls.length
    await controls.loadPlayback('r2')
    expect(playSource).toHaveBeenCalledTimes(callsBeforeDelete)
    playerState.value.source = { ...playerState.value.source!, src: '/api/artifacts/newer-r2/stream' }
    finishDelete()
    await deleting
    expect(stop).not.toHaveBeenCalled()
    expect(playerState.value.source?.src).toBe('/api/artifacts/newer-r2/stream')
    await controls.loadPlayback('r2')
    refreshRecordings.mockImplementationOnce(async () => { recordings.value = recordings.value.filter(item => item.id !== 'r2') })
    await controls.deleteRecording('r2')
    expect(request).toHaveBeenLastCalledWith('/api/recordings/r2', { method: 'DELETE' })
    expect(stop).toHaveBeenCalledOnce()
    expect(controls.playingRecordingId.value).toBe('')
    const calls = playSource.mock.calls.length
    await controls.loadPlayback('r2')
    expect(playSource).toHaveBeenCalledTimes(calls)
    wrapper.unmount()
  })

  it('validates recap file kind and preserves failed uploads for retry while blocking conflicting actions', async () => {
    const refreshRecap = vi.fn()
    let controls!: ReturnType<typeof useSessionRecap>
    const wrapper = await mountSuspended(defineComponent({
      setup() {
        controls = useSessionRecap({
          sessionId: ref('session-1'), selectedRecapKind: ref('AUDIO'),
          recap: ref(null), refreshRecap,
        })
        return () => null
      },
    }))
    controls.recapFile.value = new File(['video'], 'recap.mp4', { type: 'video/mp4' })
    await controls.uploadRecap()
    expect(request).not.toHaveBeenCalled()
    expect(controls.recapError.value).toContain('audio')
    controls.recapFile.value = new File(['audio'], 'recap.mp3', { type: 'audio/mpeg' })
    let rejectUpload!: (error: Error) => void
    request.mockImplementationOnce(() => new Promise((_, reject) => { rejectUpload = reject }))
    const uploading = controls.uploadRecap()
    await controls.uploadRecap()
    await controls.loadRecapPlayback()
    await controls.deleteRecap()
    expect(request).toHaveBeenCalledOnce()
    expect(playSource).not.toHaveBeenCalled()
    rejectUpload(new Error('Upload failed'))
    await uploading
    expect(controls.recapError.value).toBe('Upload failed')
    expect(controls.recapFile.value?.name).toBe('recap.mp3')
    await controls.uploadRecap()
    expect(request).toHaveBeenCalledTimes(2)
    expect(controls.recapFile.value).toBeNull()
    expect(refreshRecap).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
