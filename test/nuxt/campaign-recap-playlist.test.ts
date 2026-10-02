import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import type { CampaignRecapItem } from '../../shared/types/campaign-overview'
import type { MediaSource } from '../../app/composables/useMediaPlayer'
import { useCampaignRecaps } from '../../app/composables/useCampaignRecaps'
import RecapPlaylist from '../../app/components/campaign/RecapPlaylist.vue'

const harness = vi.hoisted(() => ({ player: null as unknown, resource: null as unknown, request: vi.fn() }))
mockNuxtImport('useMediaPlayer', () => () => harness.player)
mockNuxtImport('useOverviewResource', () => () => harness.resource)
mockNuxtImport('useApi', () => () => ({ request: harness.request }))

describe('CampaignRecapPlaylist', () => {
  beforeEach(() => { localStorage.clear() })

  it('selects the most recent available recap and offers its saved position', async () => {
    const recaps = ['r1', 'r2'].map(id => ({
      id, filename: id, createdAt: '2026-09-06', session: { id, title: id },
    }))
    for (const [id, updatedAt] of [['r1', 1], ['r2', 2], ['removed', 3]] as const) {
      localStorage.setItem(`dmvault-recap-progress-v1:${id}`, JSON.stringify({ position: 123, updatedAt }))
    }
    const wrapper = await mountSuspended(RecapPlaylist, { props: {
      recaps, selectedRecapId: 'r1', isPlaying: false, loading: false,
      deleting: false, error: '', deleteError: '', canDelete: false,
    }, global: { stubs: { UTooltip: { template: '<div><slot /></div>' } } } })
    expect(wrapper.emitted('select')?.[0]).toEqual(['r2'])
    await wrapper.setProps({ selectedRecapId: 'r2' })
    const resume = wrapper.findAll('button').find(button => button.text() === 'Resume at 2:03')
    expect(resume).toBeDefined()
    await resume!.trigger('click')
    expect(wrapper.emitted('play')?.[0]).toEqual(['r2'])
    wrapper.unmount()
  })
  it.each(['audio/mpeg', 'video/mp4'])('emits playback actions for %s recaps', async (mimeType) => {
    const deleteAction = vi.fn().mockResolvedValue(undefined)
    const settle = async () => { await flushPromises(); await new Promise(resolve => setTimeout(resolve, 250)); await flushPromises() }
    const wrapper = await mountSuspended(RecapPlaylist, {
      attachTo: document.body,
      global: { stubs: { UTooltip: { template: '<div><slot /></div>' } } },
      props: {
        campaignId: 'c1',
        recaps: [
          {
            id: 'r1',
            filename: 'recap-1',
            mimeType,
            createdAt: '2026-02-08T00:00:00.000Z',
            session: {
              id: 's1',
              title: 'Session One',
              sessionNumber: 1,
              playedAt: '2026-02-07T00:00:00.000Z',
            },
          },
        ],
        selectedRecapId: 'r1',
        isPlaying: true,
        loading: false,
        deleting: false,
        error: '',
        deleteError: '',
        canDelete: true,
        deleteAction,
      },
    })

    expect(wrapper.text()).toContain(mimeType.startsWith('video/') ? 'Video' : 'Audio')
    const buttons = wrapper.findAll('button')
    const playButton = buttons.find((button) => button.text().trim() === 'Play')
    const openPlayerButton = buttons.find((button) => button.text().trim() === 'Open player')

    expect(playButton).toBeDefined()
    expect(openPlayerButton).toBeDefined()

    await playButton!.trigger('click')
    await openPlayerButton!.trigger('click')

    expect(wrapper.emitted('play')?.[0]).toEqual(['r1'])
    expect(wrapper.emitted('open-player')).toBeTruthy()
    await wrapper.setProps({ isPlaying: false })
    expect(wrapper.text()).not.toContain('Open player')
    await wrapper.get('button[aria-label="Actions for Session One recap"]').trigger('click')
    await settle()
    const deleteItem = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent?.includes('Delete'))!
    deleteItem.click()
    await settle()
    expect(deleteAction).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Its file will be permanently removed.')
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Delete recap')!
    confirm.click()
    await settle()
    expect(deleteAction).toHaveBeenCalledWith('r1')
    wrapper.unmount()
  })
})

it('plays campaign recap artifacts directly, derives status from the player, and deletes only the captured source', async () => {
  const recaps = ref<CampaignRecapItem[]>([
    { id: 'audio', artifactId: 'artifact-audio', mimeType: 'audio/mpeg', filename: 'recap.mp3', createdAt: '2026-10-01', session: { id: 's1', title: 'Session one' } },
    { id: 'video', artifactId: 'artifact-video', mimeType: 'video/mp4', filename: 'recap.mp4', createdAt: '2026-10-01', session: { id: 's2', title: 'Session two' } },
  ])
  const state = ref<{ source: MediaSource | null; isPlaying: boolean; error: string; playToken: number }>({ source: null, isPlaying: false, error: '', playToken: 0 })
  const playSource = vi.fn(async (source: MediaSource) => { state.value.source = source })
  const stop = vi.fn(() => { state.value.source = null; state.value.isPlaying = false })
  const refresh = vi.fn().mockResolvedValue(undefined)
  harness.request.mockReset().mockResolvedValue(undefined)
  harness.player = { state, playSource, stop, openDrawer: vi.fn() }
  harness.resource = { data: recaps, pending: ref(false), error: ref(null), refresh }
  let controls!: ReturnType<typeof useCampaignRecaps>
  const wrapper = await mountSuspended(defineComponent({ setup() {
    controls = useCampaignRecaps(ref('c1'))
    return () => null
  } }))

  for (const [id, kind] of [['audio', 'AUDIO'], ['video', 'VIDEO']] as const) {
    state.value.isPlaying = false
    await controls.playRecap(id)
    expect(playSource).toHaveBeenLastCalledWith(expect.objectContaining({ id, recapProgressId: id, src: `/api/artifacts/artifact-${id}/stream`, kind }), { presentation: 'global', openDrawer: kind === 'VIDEO' })
    expect(controls.isRecapPlaying.value).toBe(false)
    state.value.isPlaying = true
    expect(controls.isRecapPlaying.value).toBe(true)
    state.value.error = 'Playback failed. Try again.'
    expect(controls.recapError.value).toContain('Playback failed')
    state.value.error = ''
  }
  expect(harness.request).not.toHaveBeenCalled()
  recaps.value[1]!.artifactId = 'replacement'
  expect(controls.isRecapPlaying.value).toBe(false)
  await controls.playRecap('video')
  expect(state.value.source?.src).toBe('/api/artifacts/replacement/stream')

  let finishDelete!: () => void
  harness.request.mockImplementationOnce(() => new Promise<void>(resolve => { finishDelete = resolve }))
  const deleting = controls.deleteRecap('video')
  await controls.playRecap('audio')
  expect(playSource).toHaveBeenCalledTimes(3)
  state.value.source = { id: 'video', title: 'Newer recap', src: '/api/artifacts/newer/stream', kind: 'VIDEO' }
  finishDelete()
  await deleting
  expect(stop).not.toHaveBeenCalled()
  await controls.playRecap('video')
  await controls.deleteRecap('video')
  expect(stop).toHaveBeenCalledOnce()
  expect(refresh).toHaveBeenCalledTimes(2)
  wrapper.unmount()
})
