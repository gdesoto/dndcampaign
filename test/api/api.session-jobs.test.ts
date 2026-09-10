import { afterAll, beforeAll, expect, it } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'

const prisma = createApiTestPrismaClient()
const baseUrl = getApiTestBaseUrl()
let cookie = ''
let sessionId = ''
let documentId = ''
let campaignId = ''
let emptySessionId = ''
let hiddenSessionId = ''

beforeAll(async () => {
  const password = 'session-jobs-test-password'
  const passwordHash = await new Hash(new Scrypt()).make(password)
  const owner = await prisma.user.create({ data: { email: 'jobs-owner@example.com', name: 'Jobs Owner', passwordHash } })
  const outsider = await prisma.user.create({ data: { email: 'jobs-other@example.com', name: 'Other Owner', passwordHash } })
  const campaign = await prisma.campaign.create({ data: { ownerId: owner.id, name: 'Jobs campaign' } })
  campaignId = campaign.id
  const session = await prisma.session.create({ data: { campaignId, title: 'Jobs session' } })
  sessionId = session.id
  emptySessionId = (await prisma.session.create({ data: { campaignId, title: 'Empty' } })).id
  const hiddenCampaign = await prisma.campaign.create({ data: { ownerId: outsider.id, name: 'Other campaign' } })
  hiddenSessionId = (await prisma.session.create({ data: { campaignId: hiddenCampaign.id, title: 'Hidden' } })).id
  const hiddenDocument = await prisma.document.create({ data: { campaignId: hiddenCampaign.id, sessionId: hiddenSessionId, type: 'TRANSCRIPT', title: 'Hidden transcript' } })
  await prisma.summaryJob.create({ data: {
    campaignId: hiddenCampaign.id, sessionId: hiddenSessionId, documentId: hiddenDocument.id,
    trackingId: 'hidden-job', kind: 'SUMMARY_GENERATION', mode: 'ASYNC', status: 'READY_FOR_REVIEW',
    suggestions: { create: { entityType: 'QUEST', action: 'CREATE', payload: { title: 'Hidden quest' } } },
  } })
  documentId = (await prisma.document.create({ data: { campaignId, sessionId, type: 'TRANSCRIPT', title: 'Transcript' } })).id
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.21' },
    body: JSON.stringify({ email: owner.email, password }),
  })
  expect(login.status).toBe(200)
  cookie = login.headers.get('set-cookie')?.match(/nuxt-session=[^;]+/)?.[0] || ''
}, 120_000)
afterAll(() => prisma.$disconnect())

const load = async (id: string) => {
  const result = await fetch(`${baseUrl}/api/sessions/${id}/summaries/jobs`, { headers: { cookie } })
  expect(result.status).toBe(200)
  return (await result.json()).data
}
it('returns the existing empty response for empty, missing and inaccessible sessions', async () => {
  const empty = { job: null, latestSummaryJob: null, latestSuggestionJob: null, suggestions: [], latestSummarySuggestions: [], latestSuggestionSuggestions: [], jobs: [] }
  for (const id of [emptySessionId, hiddenSessionId, 'missing-session']) expect(await load(id)).toEqual(empty)
})
it('keeps latest overall, both kinds, suggestions and ordered history consistent, including date ties', async () => {
  const createdAt = new Date('2026-09-10T00:00:00Z')
  for (const [id, kind] of [['jobs-a', 'SUMMARY_GENERATION'], ['jobs-b', 'SUMMARY_GENERATION'], ['jobs-c', 'SUGGESTION_GENERATION']] as const) {
    await prisma.summaryJob.create({ data: {
      id, campaignId, sessionId, documentId, trackingId: id, kind, mode: 'ASYNC', status: 'READY_FOR_REVIEW', createdAt,
      meta: { fullSummary: id },
      suggestions: { create: { entityType: 'QUEST', action: 'CREATE', payload: { title: id } } },
    } })
    if (id === 'jobs-a') {
      const first = await load(sessionId)
      expect(first.job.id).toBe(id)
      expect(first.latestSuggestionJob).toBeNull()
      expect(first.latestSuggestionSuggestions).toEqual([])
    }
  }
  const result = await load(sessionId)
  expect(result.jobs.map((job: { id: string }) => job.id)).toEqual(['jobs-c', 'jobs-b', 'jobs-a'])
  expect(result.job.id).toBe('jobs-c')
  expect(result.latestSummaryJob.id).toBe('jobs-b')
  expect(result.latestSuggestionJob.id).toBe('jobs-c')
  expect(result.suggestions).toEqual(result.latestSuggestionSuggestions)
  expect(result.latestSummarySuggestions[0].payload.title).toBe('jobs-b')
  expect(result.latestSummaryJob.meta.fullSummary).toBe('jobs-b')
  expect(result.latestSummaryJob).not.toHaveProperty('suggestions')
  expect(result.jobs[0]).not.toHaveProperty('meta')
})
