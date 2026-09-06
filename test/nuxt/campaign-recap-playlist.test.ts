import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RecapPlaylist from '../../app/components/campaign/RecapPlaylist.vue'

describe('CampaignRecapPlaylist', () => {
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
