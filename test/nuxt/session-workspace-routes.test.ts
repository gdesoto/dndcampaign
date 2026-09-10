import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { NuxtPage } from '#components'
import { useRouter, useState, clearNuxtData, clearNuxtState } from '#imports'
import { useSessionWorkspaceContext } from '../../app/composables/useSessionWorkspaceContext'

type Workspace = ReturnType<typeof useSessionWorkspaceContext>
const { request, discard, closeModal } = vi.hoisted(() => ({ request: vi.fn(), discard: vi.fn(), closeModal: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ request }))
mockNuxtImport('useMediaPlayer', () => () => ({ playSource: vi.fn(), openDrawer: vi.fn() }))
mockNuxtImport('useOverlay', () => () => ({ create: () => ({ open: () => ({ result: discard() }), close: closeModal }) }))

const seen: Workspace[] = []
const panel = defineComponent({
  setup() {
    const workspace = useSessionWorkspaceContext()
    seen.push(workspace)
    return () => h('div', { 'data-session': workspace.sessionId.value }, workspace.summary.summaryForm.content)
  },
})
const slotStub = { template: '<div><slot /><slot name="actions" /></div>' }
const stubs = {
  CampaignDetailTemplate: slotStub, CampaignPageHeader: slotStub,
  UCard: slotStub, SessionWorkflowTimeline: true, SessionEditModal: true,
  SessionStatusCards: true, SessionStepLinkButton: true,
  SessionRecordingsPanel: panel, SessionRecapPanel: panel,
  SessionSummaryPanel: panel, SessionTranscriptPanel: panel, SessionSuggestionsPanel: panel,
}
let wrapper: VueWrapper | undefined
let summaryContent = 'Saved summary'
let failRefresh = false

const workspaceResponse = (id: string) => ({
  session: { id, title: `Session ${id}`, notes: 'Original notes' },
  recordings: [{ id: `recording-${id}`, kind: 'VIDEO', filename: 'Recording.mp4' }],
  recaps: [{ id: `recap-${id}`, filename: 'Recap.mp3', mimeType: 'audio/mpeg' }],
  transcriptDoc: { id: `transcript-${id}`, type: 'TRANSCRIPT', currentVersion: { content: 'Transcript' } },
  summaryDoc: { id: `summary-${id}`, type: 'SUMMARY', currentVersion: { content: summaryContent } },
  access: { permissions: ['content.write', 'summary.run', 'recording.upload'] },
})

beforeEach(() => {
  clearNuxtData()
  clearNuxtState()
  useState('nuxt-session').value = { user: { id: 'u1' } }
  useState('nuxt-auth-ready').value = true
  seen.length = 0
  summaryContent = 'Saved summary'
  failRefresh = false
  discard.mockReset().mockResolvedValue(false)
  closeModal.mockClear()
  request.mockReset().mockImplementation(async (url: string, options?: { method?: string; body?: { content?: string } }) => {
    if (url.startsWith('/api/campaigns/') && url.endsWith('/workspace')) {
      return { campaign: { id: 'c1', name: 'Campaign' }, access: { permissions: ['content.write'] } }
    }
    if (url.endsWith('/workspace')) {
      if (failRefresh) throw new Error('Offline')
      return workspaceResponse(url.split('/')[3]!)
    }
    if (url.endsWith('/summaries/jobs')) {
      return { jobs: [], latestSummaryJob: null, latestSuggestionJob: null, latestSummarySuggestions: [], latestSuggestionSuggestions: [] }
    }
    if (options?.method === 'PATCH') {
      if (options.body?.content) summaryContent = options.body.content
      return {}
    }
    throw new Error(`Unexpected request: ${url}`)
  })
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined })

async function openSession(path: string) {
  wrapper = await mountSuspended(defineComponent({ render: () => h(NuxtPage) }), {
    route: path, global: { stubs },
  })
  await flushPromises()
  await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0))
  return seen.at(-1)!
}
async function navigate(path: string) {
  await useRouter().push(path)
  await flushPromises()
  await nextTick()
}

describe('session parent workspace', () => {
  it('shares one workspace across deep-linked steps and overview, preserving drafts and selections', async () => {
    const workspace = await openSession('/campaigns/c1/sessions/s1/summary')
    workspace.summary.summaryForm.content = 'Unsaved summary'
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    workspace.recording.selectedFile = new File(['audio'], 'draft.mp3')
    workspace.recap.selectedRecapKind = 'VIDEO'
    await navigate('/campaigns/c1/sessions/s1/recordings')
    await vi.waitFor(() => expect(seen.at(-1)).toBe(workspace))
    await navigate('/campaigns/c1/sessions/s1')
    await navigate('/campaigns/c1/sessions/s1/summary')
    expect(seen.length).toBeGreaterThanOrEqual(5)
    expect(seen.every(value => value === workspace)).toBe(true)
    expect(workspace.summary.summaryForm.content).toBe('Unsaved summary')
    expect(workspace.recording.selectedFile?.name).toBe('draft.mp3')
    expect(workspace.recap.selectedRecapKind).toBe('VIDEO')
    expect(discard).not.toHaveBeenCalled()
    expect(request.mock.calls.filter(([url]) => url === '/api/sessions/s1/workspace')).toHaveLength(1)
    // Both job kinds and all child routes share the same combined resource.
    expect(request.mock.calls.filter(([url]) => url === '/api/sessions/s1/summaries/jobs')).toHaveLength(1)
  })

  it('retains a summary draft through parent saves, refresh failures and successful retry', async () => {
    const workspace = await openSession('/campaigns/c1/sessions/s1/summary')
    workspace.summary.summaryForm.content = 'Unsaved summary'
    workspace.editor.form.notes = 'Edited notes'
    await workspace.editor.saveSession()
    expect(workspace.summary.summaryForm.content).toBe('Unsaved summary')
    expect(workspace.summary.summaryDirty).toBe(true)
    failRefresh = true
    await workspace.resource.refreshWorkspace()
    expect(workspace.resource.session?.id).toBe('s1')
    expect(workspace.summary.summaryForm.content).toBe('Unsaved summary')
    failRefresh = false
    await workspace.summary.saveSummary()
    expect(workspace.summary.summaryDirty).toBe(false)
    expect(workspace.summary.summaryForm.content).toBe('Unsaved summary')
  })

  it('protects session exits from overview and creates fresh state for another session', async () => {
    const workspace = await openSession('/campaigns/c1/sessions/s1/summary')
    workspace.summary.summaryForm.content = 'Unsaved summary'
    workspace.recording.selectedFile = new File(['audio'], 'draft.mp3')
    await navigate('/campaigns/c1/sessions/s1')
    await navigate('/campaigns/c1/sessions/s2/summary')
    expect(useRouter().currentRoute.value.path).toBe('/campaigns/c1/sessions/s1')
    expect(discard).toHaveBeenCalledTimes(1)
    discard.mockResolvedValue(true)
    await navigate('/campaigns/c1/sessions/s2/summary')
    await vi.waitFor(() => expect(seen.at(-1)?.sessionId.value).toBe('s2'))
    const next = seen.at(-1)!
    expect(next).not.toBe(workspace)
    expect(next.summary.summaryForm.content).toBe('Saved summary')
    expect(next.recording.selectedFile).toBeNull()
    expect(workspace.sessionId.value).toBe('s1')
    // Watchers belong to the disposed parent, even though an old reference remains.
    const calls = request.mock.calls.length
    workspace.summary.selectedSummaryJobId = 'old-job'
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(calls)
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('blocks leaving during a save but allows switching steps without losing the pending save', async () => {
    const workspace = await openSession('/campaigns/c1/sessions/s1/summary')
    workspace.summary.summaryForm.content = 'Submitted draft'
    let rejectSave!: (error: Error) => void
    request.mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject }))
    const saving = workspace.summary.saveSummary()
    expect(workspace.summary.summarySaving).toBe(true)
    await navigate('/campaigns/c1/sessions/s1/recordings')
    expect(useRouter().currentRoute.value.path).toBe('/campaigns/c1/sessions/s1/recordings')
    await navigate('/campaigns/c1/sessions/s2/summary')
    expect(useRouter().currentRoute.value.path).toBe('/campaigns/c1/sessions/s1/recordings')
    expect(discard).not.toHaveBeenCalled()
    rejectSave(new Error('Save failed'))
    await saving
    await navigate('/campaigns/c1/sessions/s1/summary')
    expect(seen.at(-1)).toBe(workspace)
    expect(workspace.summary.summaryError).toBe('Save failed')
    expect(workspace.summary.summaryForm.content).toBe('Submitted draft')
    expect(workspace.summary.summaryDirty).toBe(true)
    await workspace.summary.saveSummary()
    expect(workspace.summary.summaryDirty).toBe(false)
  })

  it('does not show the previous session after a failed new-session load and supports retry', async () => {
    await openSession('/campaigns/c1/sessions/s1/summary')
    failRefresh = true
    await navigate('/campaigns/c1/sessions/s2/summary')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Unable to load this session.'))
    expect(wrapper!.find('[data-session="s1"]').exists()).toBe(false)
    failRefresh = false
    const retry = wrapper!.findAll('button').find(button => button.text() === 'Try again')!
    await retry.trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(seen.at(-1)?.sessionId.value).toBe('s2'))
    expect(seen.at(-1)!.resource.session?.id).toBe('s2')
  })

  it('keeps a late recording upload and refresh tied to its original session', async () => {
    const original = await openSession('/campaigns/c1/sessions/s1/recordings')
    original.recording.selectedFile = new File(['audio'], 'upload.mp3')
    let finishUpload!: () => void
    request.mockImplementationOnce(() => new Promise<void>((resolve) => { finishUpload = resolve }))
    const uploading = original.recording.uploadRecording()
    await navigate('/campaigns/c1/sessions/s2/recordings')
    await vi.waitFor(() => expect(seen.at(-1)?.sessionId.value).toBe('s2'))
    const next = seen.at(-1)!
    next.recording.selectedFile = new File(['audio'], 'next.mp3')
    finishUpload()
    await uploading
    expect(next.recording.selectedFile?.name).toBe('next.mp3')
    expect(next.resource.session?.id).toBe('s2')
    expect(request.mock.calls.filter(([url]) => url === '/api/sessions/s1/recordings')).toHaveLength(1)
    expect(request.mock.calls.filter(([url]) => url === '/api/sessions/s2/workspace')).toHaveLength(1)
  })

  it.each(['overview', 'unknown-step'])('normalizes a direct %s URL within the session', async (step) => {
    const workspace = await openSession(`/campaigns/c1/sessions/s1/${step}`)
    await vi.waitFor(() => expect(useRouter().currentRoute.value.path).toBe(
      `/campaigns/c1/sessions/s1${step === 'overview' ? '' : '/suggestions'}`,
    ))
    expect(workspace.sessionId.value).toBe('s1')
    expect(request.mock.calls.filter(([url]) => url === '/api/sessions/s1/workspace')).toHaveLength(1)
  })

})
