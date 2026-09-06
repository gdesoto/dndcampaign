import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref, shallowRef } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useRecapWatch } from '../../app/composables/useRecapWatch'
import type { MediaSource } from '../../app/composables/useMediaPlayer'
import RecapLinks from '../../app/components/campaign/RecapLinks.vue'

const harness = vi.hoisted(() => ({ player: null as unknown, route: null as unknown, push: vi.fn() }))
mockNuxtImport('useMediaPlayer', () => () => harness.player)
mockNuxtImport('useRoute', () => () => harness.route)
mockNuxtImport('useRouter', () => () => ({ push: harness.push, replace: async () => {}, resolve: (to: string) => ({ href: to }) }))

describe('recap watch playlist', () => {
  const recaps = [3, 2, 1].map(number => ({
    id: `r${number}`, filename: `recap-${number}`, mimeType: number === 2 ? 'video/mp4' : 'audio/mpeg',
    createdAt: '2026-09-06', session: { id: `s${number}`, title: `Session ${number}`, sessionNumber: number },
  }))
  const state = ref<{ source: MediaSource | null; presentation: string }>({ source: null, presentation: 'page' })
  const element = shallowRef<HTMLMediaElement | null>(null)
  const loadSource = vi.fn((source: MediaSource) => { state.value.source = source })
  const playSource = vi.fn(async (source: MediaSource) => { state.value.source = source })
  const resolvePlayback = vi.fn(async (id: string) => ({ url: `https://example.test/${id}.mp4` }))
  const mount = async (id = 'r1') => {
    harness.route = { query: { recap: id } }
    let controls!: ReturnType<typeof useRecapWatch>
    const wrapper = await mountSuspended(defineComponent({
      setup() {
        controls = useRecapWatch({ recaps: ref(recaps), resolvePlayback })
        return () => null
      },
    }))
    await flushPromises()
    return { wrapper, controls }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    state.value = { source: null, presentation: 'page' }
    element.value = document.createElement('audio')
    harness.player = { state, element, loadSource, playSource, play: vi.fn(), setPresentation: vi.fn() }
    resolvePlayback.mockImplementation(async id => ({ url: `https://example.test/${id}.mp4` }))
  })

  it('honors a shared recap over saved selection and loads without autoplay', async () => {
    localStorage.setItem('dmvault-recap-progress-v1:r3', JSON.stringify({ position: 70, updatedAt: 99 }))
    const { wrapper, controls } = await mount('r2')
    expect(controls.playlist.value.map(item => item.id)).toEqual(['r1', 'r2', 'r3'])
    expect(loadSource).toHaveBeenCalledWith(expect.objectContaining({ id: 'r2', kind: 'VIDEO', recapProgressId: 'r2' }), { presentation: 'page' })
    expect(playSource).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('advances on ended, changes the URL, starts next from zero and stops at the last item', async () => {
    const { wrapper, controls } = await mount()
    element.value!.dispatchEvent(new Event('ended'))
    await flushPromises()
    expect(controls.selectedId.value).toBe('r2')
    expect(playSource).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'r2', startTime: 0 }), { presentation: 'page' })
    expect(harness.push).toHaveBeenLastCalledWith({ query: { recap: 'r2' } })
    element.value = document.createElement('video')
    element.value.dispatchEvent(new Event('ended'))
    await flushPromises()
    expect(controls.selectedId.value).toBe('r3')
    playSource.mockClear()
    element.value.dispatchEvent(new Event('ended'))
    await flushPromises()
    expect(playSource).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not advance when disabled or after leaving the watch page', async () => {
    const { wrapper, controls } = await mount()
    controls.autoAdvance.value = false
    element.value!.dispatchEvent(new Event('ended'))
    await flushPromises()
    expect(playSource).not.toHaveBeenCalled()
    controls.autoAdvance.value = true
    wrapper.unmount()
    element.value!.dispatchEvent(new Event('ended'))
    await flushPromises()
    expect(playSource).not.toHaveBeenCalled()
  })

  it('shows unavailable shared IDs without selecting a different recap', async () => {
    const { wrapper, controls } = await mount('removed')
    expect(controls.error.value).toContain('no longer available')
    expect(resolvePlayback).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('ignores a late playback response when the user chooses another recap', async () => {
    const { wrapper, controls } = await mount()
    let finish!: (value: { url: string }) => void
    resolvePlayback.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const first = controls.choose('r2')
    await controls.choose('r3')
    finish({ url: 'https://example.test/stale.mp4' })
    await first
    expect(state.value.source?.id).toBe('r3')
    expect(playSource).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('reports playback failures and permits retry', async () => {
    resolvePlayback.mockRejectedValueOnce(new Error('offline'))
    const { wrapper, controls } = await mount()
    expect(controls.error.value).toContain('Try again')
    await controls.select('r1')
    expect(controls.error.value).toBe('')
    expect(state.value.source?.id).toBe('r1')
    wrapper.unmount()
  })

  it.each(['/public/shared-campaign', '/campaigns/c1'])('copies a stable recap link for %s', async basePath => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const wrapper = await mountSuspended(RecapLinks, { props: { basePath, recapId: 'r2' } })
    expect(wrapper.find('a').attributes('href')).toBe(`${basePath}/watch?recap=r2`)
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${basePath}/watch?recap=r2`)
    expect(wrapper.text()).toContain('Link copied')
    wrapper.unmount()
  })
})
