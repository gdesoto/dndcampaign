import { config } from '@vue/test-utils'
import { actionMenuStub } from '../helpers/action-menu'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { SessionDocumentDetail } from '#shared/types/session-workflow'
import { useSessionDocuments } from '../../app/composables/useSessionDocuments'
import StatusCards from '../../app/components/session/StatusCards.vue'
import SummaryPanel from '../../app/components/session/SummaryPanel.vue'
import SuggestionsPanel from '../../app/components/session/SuggestionsPanel.vue'
import RecapPanel from '../../app/components/session/RecapPanel.vue'
import TranscriptPanel from '../../app/components/session/TranscriptPanel.vue'
import RecordingsPanel from '../../app/components/session/RecordingsPanel.vue'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ request }))

config.global.stubs.SharedActionMenu = actionMenuStub

const clickByText = async (wrapper: Awaited<ReturnType<typeof mountSuspended>>, text: string) => {
  const button = wrapper.findAll('button').find((candidate: any) => candidate.text().trim() === text)
  expect(button, `Button not found: ${text}`).toBeDefined()
  await button!.trigger('click')
}

describe('SessionStatusCards', () => {
  it('provides native links with accessible names for every session section', async () => {
    const wrapper = await mountSuspended(StatusCards, {
      props: {
        sessionPath: '/campaigns/c1/sessions/s1',
        recordingsCount: 1,
        transcriptStatus: 'Available',
        summaryStatus: 'Available',
        suggestionStatus: 'Ready for review',
        recapStatus: 'Attached',
      },
      global: {
        stubs: {
          UTooltip: {
            template: '<div><slot /></div>',
          },
        },
      },
    })

    for (const step of ['recordings', 'transcription', 'summary', 'suggestions', 'recap']) {
      const label = step === 'transcription' ? 'transcript' : step
      expect(wrapper.get(`a[aria-label="Open ${label}"]`).attributes('href')).toBe(`/campaigns/c1/sessions/s1/${step}`)
    }
    expect(wrapper.find('button[aria-label="Open recordings"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('SessionRecordingsPanel', () => {
  it('links to the recordings step and reflects current playback and conflicting actions', async () => {
    const recording = {
      id: 'r1', artifactId: 'artifact-r1', kind: 'AUDIO' as const, filename: 'first.mp3',
      mimeType: 'audio/mpeg', byteSize: 100, createdAt: '2026-09-06',
    }
    const secondRecording = { ...recording, id: 'r2', artifactId: 'artifact-r2', filename: 'second.mp3' }
    const wrapper = await mountSuspended(RecordingsPanel, {
      props: {
        campaignId: 'c1', workflowMode: false, to: '/campaigns/c1/sessions/s1/recordings',
        recordings: [recording, secondRecording],
        selectedFile: null, selectedKind: 'AUDIO', isUploading: false,
        uploadError: '', playbackError: '', loadingRecordingId: '', playingRecordingId: '',
      },
      global: { stubs: { UTooltip: { template: '<div><slot /></div>' } } },
    })
    expect(wrapper.get('a[aria-label="Open recordings"]').attributes('href')).toBe('/campaigns/c1/sessions/s1/recordings')
    await wrapper.setProps({ to: undefined })
    expect(wrapper.find('a[aria-label="Open recordings"]').exists()).toBe(false)

    expect(wrapper.text()).not.toContain('Playing in the global player.')
    const playButtons = () => wrapper.findAll('button').filter(button => button.text().trim() === 'Play')
    await playButtons()[0]!.trigger('click')
    expect(wrapper.emitted('play-recording')).toEqual([['r1']])
    expect(wrapper.text()).not.toContain('Playing in the global player.')
    await wrapper.setProps({ playingRecordingId: 'r1' })
    expect(wrapper.findAll('span').filter(span => span.text() === 'Playing in the global player.')).toHaveLength(1)
    await wrapper.setProps({ playingRecordingId: 'r2' })
    expect(wrapper.findAll('span').filter(span => span.text() === 'Playing in the global player.')).toHaveLength(1)
    await wrapper.setProps({ playingRecordingId: 'another-session-recording' })
    expect(wrapper.text()).not.toContain('Playing in the global player.')
    await wrapper.setProps({ playingRecordingId: '', deletingRecordingId: 'r1' })
    expect((playButtons()[0]!.element as HTMLButtonElement).disabled).toBe(true)
    expect((playButtons()[1]!.element as HTMLButtonElement).disabled).toBe(false)
    await playButtons()[0]!.trigger('click')
    await playButtons()[1]!.trigger('click')
    expect(wrapper.emitted('play-recording')).toEqual([['r1'], ['r2']])
    wrapper.unmount()
  })
})

describe('SessionSummaryPanel', () => {
  it('emits send and save actions', async () => {
    const wrapper = await mountSuspended(SummaryPanel, {
      props: {
        campaignId: 'c1',
        canEdit: true, canGenerate: true, dirty: true,
        selectedSummaryJobId: '',
        summaryJobOptions: [],
        summarySending: false,
        hasTranscript: true,
        summaryStatusColor: 'primary',
        summaryStatusLabel: 'Ready',
        summaryPendingText: '',
        summaryHighlights: [],
        summarySessionTags: [],
        summaryNotableDialogue: [],
        summaryConcreteFacts: [],
        summarySendError: '',
        summaryActionError: '',
        summaryContent: 'abc',
        summarySaving: false,
        summaryDocId: undefined,
        summaryFile: null,
        summaryImporting: false,
        summaryError: '',
        summaryImportError: '',
      },
    })

    await clickByText(wrapper, 'Generate summary')
    await clickByText(wrapper, 'Save summary')

    expect(wrapper.emitted('send-to-n8n')).toBeTruthy()
    expect(wrapper.emitted('save-summary')).toBeTruthy()
    await wrapper.setProps({ canEdit: false, canGenerate: false })
    await clickByText(wrapper, 'Generate summary')
    await clickByText(wrapper, 'Save summary')
    expect(wrapper.emitted('send-to-n8n')).toHaveLength(1)
    expect(wrapper.emitted('save-summary')).toHaveLength(1)
  })
})

describe('SessionSuggestionsPanel', () => {
  it('emits generation and review actions', async () => {
    const wrapper = await mountSuspended(SuggestionsPanel, {
      props: {
        canGenerate: true,
        selectedSuggestionJobId: '',
        suggestionJobOptions: [],
        suggestionSending: false,
        hasSummary: true,
        suggestionStatusColor: 'primary',
        suggestionStatusLabel: 'Ready',
        suggestionGroups: [],
        sessionSuggestion: null,
        suggestionSendError: '',
        suggestionActionError: '',
      },
    })

    await clickByText(wrapper, 'Generate suggestions')
    expect(wrapper.emitted('generate-suggestions')).toBeTruthy()
    await wrapper.setProps({ hasSummary: false })
    await clickByText(wrapper, 'Generate suggestions')
    expect(wrapper.emitted('generate-suggestions')).toHaveLength(1)
    expect(wrapper.text()).toContain('Save a summary before generating suggestions.')
  })
})

describe('SessionRecapPanel', () => {
  it('shows both attached media types and lets the user select video', async () => {
    const audio = { id: 'audio', artifactId: 'artifact-audio', filename: 'recap.mp3', mimeType: 'audio/mpeg', byteSize: 100, createdAt: '2026-09-06' }
    const video = { ...audio, id: 'video', artifactId: 'artifact-video', filename: 'recap.mp4', mimeType: 'video/mp4' }
    const wrapper = await mountSuspended(RecapPanel, {
      props: {
        workflowMode: true, canManage: true, recap: audio, recaps: [audio, video], selectedKind: 'AUDIO',
        to: '/campaigns/c1/sessions/s1/recap',
        recapFile: null, recapUploading: false, recapPlaybackLoading: false, recapDeleting: false,
        recapPlaying: false, recapError: '', recapDeleteError: '', hasRecap: true,
      },
      global: { stubs: { UTooltip: { template: '<div><slot /></div>' } } },
    })
    expect(wrapper.text()).toContain('Audio · Attached')
    expect(wrapper.text()).toContain('Video · Attached')
    expect(wrapper.get('a[aria-label="Open recap"]').attributes('href')).toBe('/campaigns/c1/sessions/s1/recap')
    expect(wrapper.text()).not.toContain('Recap is playing in the global player.')
    await wrapper.setProps({ recapPlaying: true })
    expect(wrapper.text()).toContain('Recap is playing in the global player.')
    const videoButton = wrapper.findAll('button').find((button) => button.text().includes('Video · Attached'))!
    await videoButton.trigger('click')
    expect(wrapper.emitted('update:selectedKind')?.[0]).toEqual(['VIDEO'])
    await wrapper.setProps({ selectedKind: 'VIDEO', recap: video, recapPlaying: false })
    expect(wrapper.text()).toContain('recap.mp4')
    expect(wrapper.text()).not.toContain('recap.mp3')
    expect(wrapper.text()).not.toContain('Recap is playing in the global player.')
    wrapper.unmount()
  })

  it.each(['audio/mpeg', 'video/mp4'])('emits upload/play and awaits delete actions for %s', async (mimeType) => {
    const deleteRecap = vi.fn().mockResolvedValue(undefined)
    const wrapper = await mountSuspended(RecapPanel, {
      props: {
        workflowMode: true, canManage: true,
        deleteRecap,
        recap: null,
        recaps: [],
        selectedKind: mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO',
        recapFile: new File(['media'], 'recap', { type: mimeType }),
        recapUploading: false,
        recapPlaybackLoading: false,
        recapDeleting: false,
        recapPlaying: false,
        recapError: '',
        recapDeleteError: '',
        hasRecap: false,
      },
      global: {
        stubs: {
          SharedActionMenu: actionMenuStub,
          SharedConfirmActionPopover: {
            props: ['action'],
            template: `
              <div>
                <slot name="trigger" />
                <button type="button" @click="action()">Confirm delete recap</button>
              </div>
            `,
          },
        },
      },
    })

    expect(wrapper.find('input[type="file"]').attributes('accept')).toContain(mimeType)
    await clickByText(wrapper, 'Upload recap')
    await wrapper.setProps({ recapPlaybackLoading: true })
    await clickByText(wrapper, 'Upload recap')
    expect(wrapper.emitted('upload-recap')).toHaveLength(1)
    await wrapper.setProps({ recapPlaybackLoading: false })
    await wrapper.setProps({ canManage: false })
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    expect(wrapper.findAll('button').some(button => button.text().trim() === 'Upload recap')).toBe(false)
    await wrapper.setProps({ canManage: true })

    await wrapper.setProps({
      recap: {
        id: 'recap-1',
        artifactId: 'artifact-recap-1',
        filename: 'recap.mp3',
        mimeType,
        byteSize: 1024,
        createdAt: new Date('2026-03-05T00:00:00.000Z').toISOString(),
      },
      hasRecap: true,
    })

    expect(wrapper.text()).toContain(mimeType.startsWith('video/') ? 'Video recap' : 'Audio recap')
    await clickByText(wrapper, 'Play recap')
    for (const busy of ['recapUploading', 'recapDeleting', 'recapPlaybackLoading'] as const) {
      await wrapper.setProps({ [busy]: true })
      await clickByText(wrapper, 'Play recap')
      expect(wrapper.emitted('play-recap')).toHaveLength(1)
      await wrapper.setProps({ [busy]: false })
    }
    await clickByText(wrapper, 'Confirm delete recap')

    expect(wrapper.emitted('upload-recap')).toBeTruthy()
    expect(wrapper.emitted('play-recap')).toBeTruthy()
    expect(deleteRecap).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})

describe('SessionTranscriptPanel', () => {
  it('offers creation only when missing, blocks busy actions, and retains editing/import/subtitle actions', async () => {
    const wrapper = await mountSuspended(TranscriptPanel, {
      attachTo: document.body,
      props: {
        campaignId: 'c1',
        canManageTranscript: true,
        recordings: [{ id: 'r1', filename: 'recording.mp3' }],
        transcriptDoc: { id: 'd1' },
        transcriptCreating: false,
        transcriptError: '',
        transcriptImportError: '',
        transcriptImporting: false,
        transcriptFile: new File(['text'], 'transcript.txt', { type: 'text/plain' }),
        showFullTranscript: false,
        transcriptPreview: 'Preview',
        fullTranscript: 'Full text',
        selectedSubtitleRecordingId: 'r2',
        videoOptions: [{ label: 'Video', value: 'r2' }],
        subtitleAttachLoading: false,
        subtitleAttachError: '',
      },
    })

    expect(wrapper.findAll('button').some(button => button.text().trim() === 'Create transcript')).toBe(false)
    expect(wrapper.get('a[href="/campaigns/c1/documents/d1"]').text()).toBe('Open editor')
    await clickByText(wrapper, 'Import file')
    await clickByText(wrapper, 'Show full transcript')

    const attachButton = wrapper.findAll('button').find((button) => button.text().trim() === 'Attach subtitles')
    expect(attachButton).toBeDefined()
    await attachButton!.trigger('click')

    expect(wrapper.emitted('import-transcript')).toBeTruthy()
    expect(wrapper.emitted('update:showFullTranscript')?.[0]).toEqual([true])
    expect(wrapper.emitted('attach-subtitles')).toBeTruthy()

    await wrapper.setProps({ transcriptDoc: null })
    await clickByText(wrapper, 'Create transcript')
    expect(wrapper.emitted('create-transcript')).toHaveLength(1)
    for (const busy of ['transcriptCreating', 'transcriptImporting', 'transcriptDeleting'] as const) {
      await wrapper.setProps({ [busy]: true })
      await clickByText(wrapper, 'Create transcript')
      await clickByText(wrapper, 'Import file')
      expect(wrapper.emitted('create-transcript')).toHaveLength(1)
      expect(wrapper.emitted('import-transcript')).toHaveLength(1)
      await wrapper.setProps({ [busy]: false })
    }
    await wrapper.setProps({ transcriptError: 'A transcript already exists.' })
    expect(wrapper.text()).toContain('A transcript already exists.')

    const createButton = () => wrapper.findAll('button').find(button => button.text().trim() === 'Create transcript')!
    ;(createButton().element as HTMLElement).focus()
    await createButton().trigger('click')
    await wrapper.setProps({ transcriptCreating: true })
    // Browsers can blur a focused button when it becomes disabled.
    ;(createButton().element as HTMLElement).blur()
    await wrapper.setProps({ transcriptDoc: { id: 'd2' }, transcriptCreating: false, transcriptError: '' })
    expect(document.activeElement).toBe(wrapper.get('a[href="/campaigns/c1/documents/d2"]').element)

    await wrapper.setProps({ transcriptDoc: null })
    ;(createButton().element as HTMLElement).focus()
    await createButton().trigger('click')
    await wrapper.setProps({ transcriptCreating: true })
    const recordingLink = wrapper.get('a[href="/campaigns/c1/recordings/r1?transcribe=1"]').element as HTMLElement
    recordingLink.focus()
    await wrapper.setProps({ transcriptDoc: { id: 'd3' }, transcriptCreating: false })
    expect(document.activeElement).toBe(recordingLink)

    await wrapper.setProps({ transcriptDoc: null })
    ;(createButton().element as HTMLElement).focus()
    await createButton().trigger('click')
    await wrapper.setProps({ transcriptCreating: true })
    ;(createButton().element as HTMLElement).blur()
    await wrapper.setProps({ transcriptCreating: false, transcriptError: 'Creation failed.' })
    // A later import/background update must not resume a failed Create's handoff.
    await wrapper.setProps({ transcriptDoc: { id: 'd4' } })
    expect(document.activeElement).toBe(document.body)

    await wrapper.setProps({ canManageTranscript: false })
    expect(wrapper.findAll('button').some(button => button.text().trim() === 'Create transcript')).toBe(false)
    wrapper.unmount()
  })

  it('creates one empty document, preserves failures for retry, and excludes conflicting transcript mutations', async () => {
    request.mockReset()
    const transcriptDoc = ref<SessionDocumentDetail | null>(null)
    const refresh = vi.fn().mockResolvedValue(undefined)
    let controls!: ReturnType<typeof useSessionDocuments>
    const wrapper = await mountSuspended(defineComponent({
      setup() {
        controls = useSessionDocuments({
          sessionId: ref('s1'), sessionTitle: ref('Session'), transcriptDoc,
          summaryDoc: ref(null), summaryContent: ref('Summary draft'),
          refreshTranscript: refresh, refreshSummary: vi.fn(),
        })
        return () => null
      },
    }))
    const file = new File(['Transcript import'], 'transcript.txt', { type: 'text/plain' })
    controls.transcriptFile.value = file
    let rejectCreate!: (error: Error) => void
    request.mockImplementationOnce(() => new Promise((_, reject) => { rejectCreate = reject }))
    const creating = controls.createTranscript()
    await controls.createTranscript()
    await controls.importTranscript()
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenLastCalledWith('/api/sessions/s1/documents', {
      method: 'POST', body: { type: 'TRANSCRIPT', title: 'Transcript: Session', content: '', format: 'PLAINTEXT' },
    })
    expect(controls.transcriptCreating.value).toBe(true)
    expect(controls.transcriptFile.value?.name).toBe(file.name)
    rejectCreate(new Error('A transcript already exists.'))
    await creating
    expect(controls.transcriptCreating.value).toBe(false)
    expect(controls.transcriptError.value).toBe('A transcript already exists.')
    expect(refresh).not.toHaveBeenCalled()

    request.mockResolvedValueOnce({ id: 'd1' })
    refresh.mockImplementationOnce(async () => { transcriptDoc.value = { id: 'd1', title: 'Transcript', type: 'TRANSCRIPT' } })
    await controls.createTranscript()
    await controls.createTranscript()
    expect(request).toHaveBeenCalledTimes(2)
    expect(controls.transcriptError.value).toBe('')
    expect(refresh).toHaveBeenCalledOnce()

    let rejectImport!: (error: Error) => void
    request.mockImplementationOnce(() => new Promise((_, reject) => { rejectImport = reject }))
    const importing = controls.importTranscript()
    await controls.importTranscript()
    await controls.deleteTranscript()
    await controls.createTranscript()
    expect(request).toHaveBeenCalledTimes(3)
    rejectImport(new Error('Import failed.'))
    await importing
    expect(controls.transcriptImporting.value).toBe(false)
    expect(controls.transcriptImportError.value).toBe('Import failed.')
    expect(controls.transcriptFile.value?.name).toBe(file.name)
    request.mockResolvedValueOnce(undefined)
    await controls.importTranscript()
    expect(controls.transcriptFile.value).toBeNull()
    expect(controls.transcriptImportError.value).toBe('')

    controls.transcriptFile.value = file
    let finishDelete!: () => void
    request.mockImplementationOnce(() => new Promise<void>((resolve) => { finishDelete = resolve }))
    refresh.mockImplementationOnce(async () => { transcriptDoc.value = null })
    const deleting = controls.deleteTranscript()
    await controls.deleteTranscript()
    await controls.importTranscript()
    await controls.createTranscript()
    expect(request).toHaveBeenCalledTimes(5)
    expect(controls.transcriptDeleting.value).toBe(true)
    finishDelete()
    await deleting
    expect(controls.transcriptDeleting.value).toBe(false)
    await controls.createTranscript()
    expect(request).toHaveBeenCalledTimes(6)
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(0)
    wrapper.unmount()
  })
})
