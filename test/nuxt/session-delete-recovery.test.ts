import { expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Component } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import RecordingsPanel from '../../app/components/session/RecordingsPanel.vue'
import TranscriptPanel from '../../app/components/session/TranscriptPanel.vue'
import RecapPanel from '../../app/components/session/RecapPanel.vue'
import { useSessionRecordings } from '../../app/composables/useSessionRecordings'
import { useSessionDocuments } from '../../app/composables/useSessionDocuments'
import { useSessionRecap } from '../../app/composables/useSessionRecap'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ request }))
mockNuxtImport('useMediaPlayer', () => () => ({ playSource: vi.fn() }))

it.each(['recording', 'transcript', 'recap'] as const)('keeps the %s confirmation pending, retains errors, and retries', async (kind) => {
  let rejectDelete!: (error: Error) => void
  request.mockReset().mockImplementationOnce(() => new Promise((_, reject) => { rejectDelete = reject }))
  const refresh = vi.fn().mockResolvedValue(undefined)
  const close = vi.fn()
  const wrapper = await mountSuspended(defineComponent({
    setup() {
      const media = { id: 'r1', filename: 'Session audio.mp3', mimeType: 'audio/mpeg', byteSize: 100, createdAt: '2026-09-09' }
      let panel: Component
      let props: Record<string, unknown>
      if (kind === 'recording') {
        const controls = useSessionRecordings({ sessionId: ref('s1'), recordings: ref([]), refreshRecordings: refresh })
        panel = RecordingsPanel
        props = { workflowMode: true, campaignId: 'c1', canManageRecordings: true, recordings: [{ ...media, kind: 'AUDIO' }], selectedFile: null, selectedKind: 'AUDIO', isUploading: false, uploadError: '', playbackError: '', playbackLoading: {}, playbackUrls: {}, deleteRecording: controls.deleteRecording }
      } else if (kind === 'transcript') {
        const controls = useSessionDocuments({ sessionId: ref('s1'), sessionTitle: ref('Session'), transcriptDoc: ref({ id: 'd1', title: 'Transcript', type: 'TRANSCRIPT' }), summaryDoc: ref(null), transcriptContent: ref(''), summaryContent: ref(''), refreshTranscript: refresh, refreshSummary: refresh })
        panel = TranscriptPanel
        props = { campaignId: 'c1', canManageTranscript: true, recordings: [], transcriptDoc: { id: 'd1' }, transcriptError: '', transcriptImportError: '', transcriptImporting: false, transcriptFile: null, showFullTranscript: false, transcriptPreview: '', fullTranscript: '', selectedSubtitleRecordingId: '', videoOptions: [], subtitleAttachLoading: false, subtitleAttachError: '', deleteTranscript: controls.deleteTranscript }
      } else {
        const controls = useSessionRecap({ sessionId: ref('s1'), selectedRecapKind: ref('AUDIO'), recap: ref(media), refreshRecap: refresh })
        panel = RecapPanel
        props = { workflowMode: true, recap: media, recaps: [media], selectedKind: 'AUDIO', recapFile: null, recapUploading: false, recapPlaybackLoading: false, recapDeleting: false, recapPlaybackUrl: '', recapError: '', recapDeleteError: '', hasRecap: true, deleteRecap: controls.deleteRecap }
      }
      return () => h(panel, props)
    },
  }), {
    global: { stubs: {
      UPopover: {
        props: ['dismissible'], setup: () => ({ close }),
        template: '<div data-confirmation :data-dismissible="dismissible"><slot /><slot name="content" :close="close" /></div>',
      },
    } },
  })
  const prompt = wrapper.find('[data-confirmation]')
  const buttons = prompt.findAll('button')
  const confirm = buttons.at(-1)!
  const cancel = buttons.find(button => button.text() === 'Cancel')!
  await confirm.trigger('click')
  await confirm.trigger('click')
  expect(request).toHaveBeenCalledTimes(1)
  expect(cancel.attributes('disabled')).toBeDefined()
  expect(prompt.attributes('data-dismissible')).toBe('false')
  expect(close).not.toHaveBeenCalled()
  rejectDelete(new Error('Deletion failed. Try again.'))
  await flushPromises()
  expect(prompt.find('[role="alert"]').text()).toContain('Deletion failed')
  expect(close).not.toHaveBeenCalled()
  expect(refresh).not.toHaveBeenCalled()
  request.mockResolvedValueOnce(undefined)
  await confirm.trigger('click')
  await flushPromises()
  expect(request).toHaveBeenCalledTimes(2)
  expect(refresh).toHaveBeenCalledOnce()
  expect(close).toHaveBeenCalledOnce()
  wrapper.unmount()
})
