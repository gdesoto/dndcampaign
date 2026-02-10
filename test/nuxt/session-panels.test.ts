import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import StatusCards from '../../app/components/session/StatusCards.vue'
import SummaryPanel from '../../app/components/session/SummaryPanel.vue'
import SuggestionsPanel from '../../app/components/session/SuggestionsPanel.vue'
import RecapPanel from '../../app/components/session/RecapPanel.vue'
import TranscriptPanel from '../../app/components/session/TranscriptPanel.vue'

const clickByText = async (wrapper: Awaited<ReturnType<typeof mountSuspended>>, text: string) => {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().trim() === text)
  expect(button, `Button not found: ${text}`).toBeDefined()
  await button!.trigger('click')
}

describe('SessionStatusCards', () => {
  it('emits jump-step from workflow open-step action', async () => {
    const wrapper = await mountSuspended(StatusCards, {
      props: {
        recordingsCount: 1,
        transcriptStatus: 'Available',
        summaryStatus: 'Available',
        suggestionStatus: 'Ready for review',
        recapStatus: 'Attached',
        mode: 'workflow',
        activeStep: 'recordings',
      },
      global: {
        stubs: {
          UTooltip: {
            template: '<div><slot /></div>',
          },
        },
      },
    })

    const openButtons = wrapper.findAll('button[aria-label="Open step"]')
    expect(openButtons.length).toBeGreaterThan(0)
    await openButtons[0]!.trigger('click')

    expect(wrapper.emitted('jump-step')?.[0]).toEqual(['recordings'])
  })
})

describe('SessionSummaryPanel', () => {
  it('emits send and save actions', async () => {
    const wrapper = await mountSuspended(SummaryPanel, {
      props: {
        campaignId: 'c1',
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

    await clickByText(wrapper, 'Send transcript to n8n')
    await clickByText(wrapper, 'Save summary')

    expect(wrapper.emitted('send-to-n8n')).toBeTruthy()
    expect(wrapper.emitted('save-summary')).toBeTruthy()
  })
})

describe('SessionSuggestionsPanel', () => {
  it('emits generation and review actions', async () => {
    const wrapper = await mountSuspended(SuggestionsPanel, {
      props: {
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
  })
})

describe('SessionRecapPanel', () => {
  it('emits upload/play/delete actions in workflow mode', async () => {
    const wrapper = await mountSuspended(RecapPanel, {
      props: {
        workflowMode: true,
        recapFile: null,
        recapUploading: false,
        recapPlaybackLoading: false,
        recapDeleting: false,
        recapPlaybackUrl: '',
        recapError: '',
        recapDeleteError: '',
        hasRecap: true,
      },
    })

    await clickByText(wrapper, 'Upload recap')
    await clickByText(wrapper, 'Play recap')
    await clickByText(wrapper, 'Delete recap')

    expect(wrapper.emitted('upload-recap')).toBeTruthy()
    expect(wrapper.emitted('play-recap')).toBeTruthy()
    expect(wrapper.emitted('delete-recap')).toBeTruthy()
  })
})

describe('SessionTranscriptPanel', () => {
  it('emits create/import/attach actions and toggles transcript state', async () => {
    const wrapper = await mountSuspended(TranscriptPanel, {
      props: {
        campaignId: 'c1',
        recordings: [{ id: 'r1', filename: 'recording.mp3' }],
        transcriptDoc: { id: 'd1' },
        transcriptError: '',
        transcriptImportError: '',
        transcriptImporting: false,
        transcriptFile: null,
        showFullTranscript: false,
        transcriptPreview: 'Preview',
        fullTranscript: 'Full text',
        selectedSubtitleRecordingId: 'r2',
        videoOptions: [{ label: 'Video', value: 'r2' }],
        subtitleAttachLoading: false,
        subtitleAttachError: '',
      },
    })

    await clickByText(wrapper, 'Create transcript')
    await clickByText(wrapper, 'Import file')
    await clickByText(wrapper, 'Show full transcript')

    const attachButton = wrapper.findAll('button').find((button) => button.text().trim() === 'Attach subtitles')
    expect(attachButton).toBeDefined()
    await attachButton!.trigger('click')

    expect(wrapper.emitted('create-transcript')).toBeTruthy()
    expect(wrapper.emitted('import-transcript')).toBeTruthy()
    expect(wrapper.emitted('update:showFullTranscript')?.[0]).toEqual([true])
    expect(wrapper.emitted('attach-subtitles')).toBeTruthy()
  })
})
