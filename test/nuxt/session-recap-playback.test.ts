import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useSessionRecap } from '../../app/composables/useSessionRecap'

const { request, playSource } = vi.hoisted(() => ({ request: vi.fn(), playSource: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ request }))
mockNuxtImport('useMediaPlayer', () => () => ({ playSource }))

describe('session recap playback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    request.mockResolvedValue({ url: '/api/artifacts/recap/stream' })
  })

  it.each([
    ['audio/mpeg', 'AUDIO', false],
    ['video/mp4', 'VIDEO', true],
    ['video/webm', 'VIDEO', true],
  ])('plays %s using the existing media player, including repeat plays', async (mimeType, kind, openDrawer) => {
    let recap!: ReturnType<typeof useSessionRecap>
    const wrapper = await mountSuspended(defineComponent({
      setup() {
        recap = useSessionRecap({
          sessionId: ref('session-1'),
          selectedRecapKind: ref(mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO'),
          recap: ref({ id: 'recap-1', filename: 'recap', mimeType, byteSize: 100, createdAt: '2026-09-06' }),
          refreshRecap: vi.fn(),
        })
        return () => null
      },
    }))
    await recap.loadRecapPlayback()
    await recap.loadRecapPlayback()
    expect(request).toHaveBeenCalledTimes(1)
    expect(playSource).toHaveBeenCalledTimes(2)
    expect(playSource).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind, src: '/api/artifacts/recap/stream' }),
      { presentation: 'global', openDrawer },
    )
    wrapper.unmount()
  })
  it('switches media without reusing the other recap URL and deletes only the selection', async () => {
    const selectedRecapKind = ref<'AUDIO' | 'VIDEO'>('AUDIO')
    const audio = { id: 'audio-1', filename: 'audio.mp3', mimeType: 'audio/mpeg', byteSize: 100, createdAt: '2026-09-06' }
    const video = { ...audio, id: 'video-1', filename: 'video.mp4', mimeType: 'video/mp4' }
    const refreshRecap = vi.fn()
    request.mockImplementation((url: string) => Promise.resolve({ url: `${url}/stream` }))
    let controls!: ReturnType<typeof useSessionRecap>
    const wrapper = await mountSuspended(defineComponent({
      setup() {
        controls = useSessionRecap({
          sessionId: ref('session-1'), selectedRecapKind,
          recap: computed(() => selectedRecapKind.value === 'AUDIO' ? audio : video),
          refreshRecap,
        })
        return () => null
      },
    }))
    await controls.loadRecapPlayback()
    controls.recapFile.value = new File(['audio'], 'replacement.mp3', { type: 'audio/mpeg' })
    selectedRecapKind.value = 'VIDEO'
    await nextTick()
    expect(controls.recapPlaybackUrl.value).toBe('')
    expect(controls.recapFile.value).toBeNull()
    await controls.loadRecapPlayback()
    expect(playSource).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'video-1', kind: 'VIDEO', src: '/api/recaps/video-1/playback/url/stream' }),
      { presentation: 'global', openDrawer: true },
    )
    await controls.deleteRecap()
    expect(request).toHaveBeenLastCalledWith('/api/recaps/video-1', { method: 'DELETE' })
    expect(refreshRecap).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('rejects a file for the other media slot before uploading', async () => {
    let controls!: ReturnType<typeof useSessionRecap>
    const wrapper = await mountSuspended(defineComponent({
      setup() {
        controls = useSessionRecap({
          sessionId: ref('session-1'), selectedRecapKind: ref('AUDIO'),
          recap: ref(null), refreshRecap: vi.fn(),
        })
        return () => null
      },
    }))
    controls.recapFile.value = new File(['video'], 'recap.mp4', { type: 'video/mp4' })
    await controls.uploadRecap()
    expect(request).not.toHaveBeenCalled()
    expect(controls.recapError.value).toContain('audio')
    wrapper.unmount()
  })

})
