import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState, refreshNuxtData } from '#imports'
import { USelect } from '#components'
import type { MediaSource } from '../../app/composables/useMediaPlayer'
import RecordingPage from '../../app/pages/campaigns/[campaignId]/recordings/[recordingId].vue'
import DocumentPage from '../../app/pages/campaigns/[campaignId]/documents/[documentId].vue'

const harness = vi.hoisted(() => ({ request: vi.fn(), player: null as unknown }))
mockNuxtImport('useApi', () => () => ({ request: harness.request }))
mockNuxtImport('useMediaPlayer', () => () => harness.player)
mockNuxtImport('useRoute', original => () => ({
  ...original(), params: { campaignId: 'c1', recordingId: 'r1', documentId: 'd1' }, query: {},
}))

const state = ref<{ source: MediaSource | null; currentTime: number; error: string; isPlaying: boolean }>({
  source: null, currentTime: 0, error: '', isPlaying: false,
})
const loadSource = vi.fn((source: MediaSource) => {
  state.value.source = source
  state.value.error = ''
  state.value.isPlaying = false
})
const playSource = vi.fn(async (source: MediaSource) => {
  state.value.source = source
  state.value.currentTime = source.startTime ?? 0
  state.value.error = ''
  state.value.isPlaying = true
})
const pause = vi.fn(() => { state.value.isPlaying = false })
const stop = vi.fn(() => { state.value.source = null; state.value.isPlaying = false })
const play = vi.fn()
const seek = vi.fn()

const recordingFixture = (id: string, kind: 'AUDIO' | 'VIDEO') => ({
  id, sessionId: 's1', kind, filename: `${id}.${kind === 'VIDEO' ? 'mp4' : 'mp3'}`,
  mimeType: kind === 'VIDEO' ? 'video/mp4' : 'audio/mpeg', byteSize: 100, durationSeconds: 60,
  artifactId: `artifact-${id}`, vttArtifactId: kind === 'VIDEO' ? `captions-${id}` : null,
  createdAt: '2026-10-01T12:00:00.000Z',
})
let recordings: Record<string, ReturnType<typeof recordingFixture>>
const failedRecordings = new Set<string>()
const transcript = {
  id: 'd1', type: 'TRANSCRIPT', title: 'Session transcript', sessionId: 's1', recordingId: 'r1',
  currentVersionId: 'v1',
  currentVersion: {
    id: 'v1', format: 'PLAINTEXT', versionNumber: 1, source: 'MANUAL', createdAt: '2026-10-01T12:00:00.000Z',
    content: JSON.stringify({ version: 1, segments: [{ id: 'segment-1', startMs: 2000, endMs: 4000, text: 'Enter the crypt.', speaker: 'DM' }] }),
  },
}
const slots = { template: '<div><slot name="header" /><slot name="actions" /><slot /><slot name="footer" /></div>' }
const global = {
  provide: { campaignAccess: computed(() => ({ permissions: ['document.edit', 'recording.upload'] })) },
  stubs: { CampaignTemplatesDetail: slots, UCard: slots, UTooltip: slots, MediaPlayerDock: true, UModal: true },
}
let wrapper: VueWrapper | undefined
const button = (label: string) => wrapper!.findAll('button').find(item => item.text().trim() === label)!

beforeEach(() => {
  clearNuxtData()
  clearNuxtState()
  vi.clearAllMocks()
  recordings = { r1: recordingFixture('r1', 'VIDEO'), r2: recordingFixture('r2', 'AUDIO') }
  failedRecordings.clear()
  state.value = { source: null, currentTime: 0, error: '', isPlaying: false }
  harness.player = { state, loadSource, playSource, pause, stop, play, seek }
  harness.request.mockReset().mockImplementation(async (url: string) => {
    const match = url.match(/^\/api\/recordings\/(r\d+)$/)
    if (match) {
      if (failedRecordings.has(match[1]!)) throw new Error('Recording unavailable')
      return { ...recordings[match[1]!] }
    }
    if (url === '/api/documents/d1' || url === '/api/sessions/s1/documents?type=TRANSCRIPT') return structuredClone(transcript)
    if (url === '/api/documents/d1/versions') return []
    if (url === '/api/sessions/s1/recordings') return Object.values(recordings).map(item => ({ ...item }))
    if (url === '/api/sessions/s1') return { id: 's1' }
    if (url === '/api/campaigns/c1') return { id: 'c1', dungeonMasterName: 'DM' }
    if (url.startsWith('/api/campaigns/c1/glossary?')) return []
    if (url.startsWith('/api/artifacts/')) return { id: url.split('/').at(-1), storageKey: 'captions.vtt', createdAt: '2026-10-01T12:00:00.000Z' }
    if (/\/recordings\/r\d+\/(vtt\/history|transcriptions)$/.test(url)) return []
    throw new Error(`Unexpected request: ${url}`)
  })
})

afterEach(() => { wrapper?.unmount(); wrapper = undefined })

describe('recording and transcript page playback', () => {
  it('plays recording artifacts with captions and recovers from a failed detail refresh without a URL lookup', async () => {
    wrapper = await mountSuspended(RecordingPage, { global })
    await flushPromises()
    await button('Play in page player').trigger('click')
    expect(playSource).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'r1', kind: 'VIDEO', title: 'r1.mp4', src: '/api/artifacts/artifact-r1/stream',
      vttUrl: '/api/artifacts/captions-r1/stream',
    }), { presentation: 'page' })

    failedRecordings.add('r1')
    await refreshNuxtData('recording-r1')
    await flushPromises()
    expect(wrapper.text()).toContain('Unable to load this recording.')
    expect(button('Play in page player')).toBeUndefined()
    expect(playSource).toHaveBeenCalledTimes(1)

    failedRecordings.clear()
    recordings.r1 = { ...recordings.r1!, artifactId: 'replacement-r1', vttArtifactId: 'replacement-captions' }
    await button('Try again').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(button('Play in page player')).toBeDefined())
    await button('Play in page player').trigger('click')
    expect(playSource).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'r1', src: '/api/artifacts/replacement-r1/stream', vttUrl: '/api/artifacts/replacement-captions/stream',
    }), { presentation: 'page' })
    expect(harness.request.mock.calls.some(([url]) => url.includes('/playback/url'))).toBe(false)
  })

  it('loads the selected transcript recording and keeps segment timing tied to its current artifact through replacement and recovery', async () => {
    wrapper = await mountSuspended(DocumentPage, { global })
    await flushPromises()
    await vi.waitFor(() => expect(loadSource).toHaveBeenCalledWith(expect.objectContaining({
      id: 'r1', kind: 'VIDEO', src: '/api/artifacts/artifact-r1/stream', vttUrl: '/api/artifacts/captions-r1/stream',
    }), { presentation: 'page' }))
    expect(playSource).not.toHaveBeenCalled()
    const playSegment = () => wrapper!.get('button[aria-label="Play segment"]')
    await playSegment().trigger('click')
    await flushPromises()
    expect(playSource).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'r1', src: '/api/artifacts/artifact-r1/stream', startTime: 2,
    }), { presentation: 'page' })
    expect(seek).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
    state.value.currentTime = 4
    await vi.waitFor(() => expect(pause).toHaveBeenCalledOnce())

    const selectRecording = async (id: string) => {
      const selector = wrapper!.findAllComponents(USelect).find(item =>
        item.text().includes('r1.mp4 (VIDEO)') || item.text().includes('r2.mp3 (AUDIO)'))!
      selector.vm.$emit('update:modelValue', id)
      await nextTick()
      await flushPromises()
    }
    state.value.error = 'Unable to load media. Select it again to retry.'
    failedRecordings.add('r2')
    await selectRecording('r2')
    expect(wrapper.text()).toContain('Unable to load media. Select it again to retry.')
    expect(wrapper.text()).toContain('Enter the crypt.')
    await playSegment().trigger('click')
    expect(playSource).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Select a recording to play this segment.')

    failedRecordings.clear()
    await refreshNuxtData('document-recording-r2')
    await flushPromises()
    expect(loadSource).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'r2', kind: 'AUDIO', src: '/api/artifacts/artifact-r2/stream', vttUrl: undefined,
    }), { presentation: 'page' })
    recordings.r2 = { ...recordings.r2!, artifactId: 'replacement-r2' }
    await refreshNuxtData('document-recording-r2')
    await flushPromises()
    expect(loadSource).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'r2', src: '/api/artifacts/replacement-r2/stream',
    }), { presentation: 'page' })

    let finishPlayback!: () => void
    playSource.mockImplementationOnce(async (source: MediaSource) => {
      state.value.source = source
      await new Promise<void>(resolve => { finishPlayback = resolve })
    })
    await playSegment().trigger('click')
    expect(playSource).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'r2', src: '/api/artifacts/replacement-r2/stream', startTime: 2,
    }), { presentation: 'page' })
    await selectRecording('r1')
    expect(state.value.source?.src).toBe('/api/artifacts/artifact-r1/stream')
    finishPlayback()
    await flushPromises()
    state.value.currentTime = 10
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(pause).toHaveBeenCalledOnce()
    expect(harness.request.mock.calls.some(([url]) => url.includes('/playback/url'))).toBe(false)
  })
})
