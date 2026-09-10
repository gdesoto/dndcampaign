import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState } from '#imports'
import { useSessionJobs } from '../../app/composables/useSessionJobs'
import { useSummaryJobState } from '../../app/composables/useSummaryJobState'
import type { SessionSummaryJobDetail, SessionSummaryJobResponse } from '../../shared/types/session-workflow'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ request }))
const job = (id: string, kind: SessionSummaryJobDetail['kind'] = 'SUMMARY_GENERATION'): SessionSummaryJobDetail => ({
  id, kind, status: 'READY_FOR_REVIEW', mode: 'ASYNC', trackingId: id,
  createdAt: '2026-09-10T00:00:00Z', updatedAt: '2026-09-10T00:00:00Z',
  meta: { summaryContent: { fullSummary: id } },
  suggestions: [{ id: `${id}-suggestion`, entityType: 'QUEST', action: 'CREATE', status: 'PENDING', payload: {} }],
})
let response: SessionSummaryJobResponse
let wrapper: VueWrapper | undefined
let resource: ReturnType<typeof useSessionJobs>
let summary: ReturnType<typeof useSummaryJobState>
let suggestions: ReturnType<typeof useSummaryJobState>

beforeEach(() => {
  clearNuxtData()
  clearNuxtState()
  const latest = job('latest-summary')
  const latestSuggestion = job('latest-suggestion', 'SUGGESTION_GENERATION')
  response = {
    job: latest, suggestions: latest.suggestions, latestSummaryJob: latest, latestSuggestionJob: latestSuggestion,
    latestSummarySuggestions: latest.suggestions, latestSuggestionSuggestions: latestSuggestion.suggestions,
    jobs: [latest, latestSuggestion, job('old-1'), job('old-2')],
  }
  request.mockReset().mockImplementation(async (url: string) => url.endsWith('/summaries/jobs') ? structuredClone(response) : job(url.split('/').at(-1)!))
})
afterEach(() => wrapper?.unmount())
async function mountJobs() {
  wrapper = await mountSuspended(defineComponent({ setup() {
    resource = useSessionJobs(ref('s1'))
    summary = useSummaryJobState({ jobs: resource, jobKind: 'SUMMARY_GENERATION' })
    suggestions = useSummaryJobState({ jobs: resource, jobKind: 'SUGGESTION_GENERATION' })
    return () => null
  } }))
  await flushPromises()
}

it('loads both latest jobs and suggestions once without detail requests', async () => {
  await mountJobs()
  expect(request).toHaveBeenCalledTimes(1)
  expect(summary.summaryJob.value?.id).toBe('latest-summary')
  expect(suggestions.summaryJob.value?.id).toBe('latest-suggestion')
  expect(summary.summarySuggestions.value[0]?.id).toBe('latest-summary-suggestion')
  expect(suggestions.summarySuggestions.value[0]?.id).toBe('latest-suggestion-suggestion')
  summary.selectedSummaryJobId.value = 'old-1'
  await flushPromises()
  expect(summary.summaryJob.value?.id).toBe('old-1')
  expect(suggestions.selectedSummaryJobId.value).toBe('latest-suggestion')
  summary.selectedSummaryJobId.value = 'latest-summary'
  await flushPromises()
  expect(request).toHaveBeenCalledTimes(2)
  expect(summary.summaryJob.value?.id).toBe('latest-summary')
})

it('ignores a late historical response after the selected job changes', async () => {
  await mountJobs()
  let finishOld!: (value: SessionSummaryJobDetail) => void
  request.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
  summary.selectedSummaryJobId.value = 'old-1'
  await flushPromises()
  expect(summary.summaryJob.value).toBeNull()
  summary.selectedSummaryJobId.value = 'old-2'
  await flushPromises()
  expect(summary.summaryJob.value?.id).toBe('old-2')
  finishOld(job('old-1'))
  await flushPromises()
  expect(summary.summaryJob.value?.id).toBe('old-2')
})

it('refreshes both latest views and only reloads a selected historical job when needed', async () => {
  await mountJobs()
  response.latestSummaryJob!.status = 'APPLIED'
  response.latestSuggestionJob!.status = 'APPLIED'
  await summary.refreshSummaryJob()
  expect(request).toHaveBeenCalledTimes(2)
  expect(suggestions.summaryJob.value?.status).toBe('APPLIED')
  summary.selectedSummaryJobId.value = 'old-1'
  await flushPromises()
  const count = request.mock.calls.length
  await summary.refreshSummaryJob()
  expect(request).toHaveBeenCalledTimes(count + 2)
  expect(summary.summaryJob.value?.id).toBe('old-1')
})

it('retains results after list refresh failure and allows retry', async () => {
  await mountJobs()
  request.mockRejectedValueOnce(new Error('Offline'))
  await expect(resource.refresh()).rejects.toThrow('Offline')
  expect(summary.summaryJob.value?.id).toBe('latest-summary')
  expect(suggestions.summaryJob.value?.id).toBe('latest-suggestion')
  expect(resource.error.value).toBeTruthy()
  await resource.refresh()
  expect(resource.error.value).toBeFalsy()
})

it('keeps the selected job when a newer job arrives and loads its historical details once', async () => {
  await mountJobs()
  response.latestSummaryJob = job('new-summary')
  response.jobs.unshift(response.latestSummaryJob)
  await summary.refreshSummaryJob()
  await flushPromises()
  expect(summary.selectedSummaryJobId.value).toBe('latest-summary')
  expect(summary.summaryJob.value?.id).toBe('latest-summary')
  expect(request.mock.calls.map(([url]) => url)).toEqual([
    '/api/sessions/s1/summaries/jobs', '/api/sessions/s1/summaries/jobs', '/api/summaries/jobs/latest-summary',
  ])
})

it('surfaces historical detail failures and retries without changing selection', async () => {
  await mountJobs()
  request.mockRejectedValueOnce(new Error('Detail unavailable'))
  summary.selectedSummaryJobId.value = 'old-1'
  await flushPromises()
  expect(summary.loadError.value?.message).toBe('Detail unavailable')
  expect(summary.summaryJob.value).toBeNull()
  await summary.refreshSummaryJob()
  expect(summary.summaryJob.value?.id).toBe('old-1')
  expect(summary.loadError.value).toBeFalsy()
})
