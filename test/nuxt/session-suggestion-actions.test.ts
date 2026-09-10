import { expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useSessionSuggestionJobs } from '../../app/composables/useSessionSuggestionJobs'

const { request, jobState } = vi.hoisted(() => ({ request: vi.fn(), jobState: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ request }))
mockNuxtImport('useSummaryJobState', () => jobState)

it.each(['apply', 'discard'] as const)('serializes %s with other suggestion actions and permits retry', async (action) => {
  let rejectRequest!: (reason: Error) => void
  request.mockReset().mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject }))
  jobState.mockReturnValue({
    loadError: ref(null),
    selectedSummaryJobId: ref('j1'), summaryJob: ref(null), summaryJobHistory: ref([]), summaryJobOptions: ref([]),
    summarySuggestions: ref([{ id: 's1', entityType: 'SESSION' }, { id: 'q1', entityType: 'QUEST' }]),
    refreshSummaryJob: vi.fn(), refreshSelectedSummaryJob: vi.fn(),
  })
  let controls!: ReturnType<typeof useSessionSuggestionJobs>
  const wrapper = await mountSuspended(defineComponent({
    setup() {
      controls = useSessionSuggestionJobs({ sessionId: ref('s1'), summaryDoc: ref({ id: 'd1' }), jobs: { sessionId: ref('s1'), data: ref(null), pending: ref(false), error: ref(undefined), refresh: vi.fn() } })
      return () => null
    },
  }))
  expect(controls.sessionSuggestion.value?.id).toBe('s1')
  expect(controls.suggestionGroups.value.map(group => group.label)).toEqual(['QUEST'])
  const pending = action === 'apply'
    ? controls.applySuggestion({ suggestionId: 'q1', payload: {} })
    : controls.discardSuggestion('q1')
  expect(controls.suggestionApplying.value).toBe(true)
  await controls.applySuggestion({ suggestionId: 'q1', payload: {} })
  await controls.discardSuggestion('q1')
  await controls.generateSuggestions()
  expect(request).toHaveBeenCalledTimes(1)
  rejectRequest(new Error('Try again'))
  await pending
  expect(controls.suggestionApplying.value).toBe(false)
  expect(controls.suggestionActionError.value).toBe('Try again')
  request.mockResolvedValueOnce(undefined)
  await controls.discardSuggestion('q1')
  expect(request).toHaveBeenCalledTimes(2)
  expect(controls.suggestionActionError.value).toBe('')
  wrapper.unmount()
})
