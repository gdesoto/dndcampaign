import { beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RecapPlaylist from '../../app/components/campaign/RecapPlaylist.vue'

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
      recaps, selectedRecapId: 'r1', playbackUrl: '', loading: false,
      deleting: false, error: '', deleteError: '', canDelete: false,
    } })
    expect(wrapper.emitted('select')?.[0]).toEqual(['r2'])
    await wrapper.setProps({ selectedRecapId: 'r2' })
    const resume = wrapper.findAll('button').find(button => button.text() === 'Resume at 2:03')
    expect(resume).toBeDefined()
    await resume!.trigger('click')
    expect(wrapper.emitted('play')?.[0]).toEqual(['r2'])
    wrapper.unmount()
  })
  it.each(['audio/mpeg', 'video/mp4'])('emits playback actions for %s recaps', async (mimeType) => {
    const wrapper = await mountSuspended(RecapPlaylist, {
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
        playbackUrl: 'https://example.test/recap.mp3',
        loading: false,
        deleting: false,
        error: '',
        deleteError: '',
      },
    })

    expect(wrapper.text()).toContain(mimeType.startsWith('video/') ? 'Video' : 'Audio')
    const buttons = wrapper.findAll('button')
    const playButton = buttons.find((button) => button.text().trim() === 'Play')
    const deleteButton = buttons.find((button) => button.text().trim() === 'Delete')
    const openPlayerButton = buttons.find((button) => button.text().trim() === 'Open player')

    expect(playButton).toBeDefined()
    expect(deleteButton).toBeDefined()
    expect(openPlayerButton).toBeDefined()

    await playButton!.trigger('click')
    await deleteButton!.trigger('click')
    await openPlayerButton!.trigger('click')

    expect(wrapper.emitted('play')?.[0]).toEqual(['r1'])
    expect(wrapper.emitted('delete')?.[0]).toEqual(['r1'])
    expect(wrapper.emitted('open-player')).toBeTruthy()
  })
})
