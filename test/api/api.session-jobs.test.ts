import { afterAll, beforeAll, expect, it } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { createApiTestDatabase } from '../scripts/db-test-client'
import * as tables from '../../server/db/schema'
import { eq } from 'drizzle-orm'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'

const db = createApiTestDatabase()
const baseUrl = getApiTestBaseUrl()
let cookie = ''
let sessionId = ''
let documentId = ''
let campaignId = ''
let emptySessionId = ''
let hiddenSessionId = ''
let recordingId = ''
let taggedTranscriptionJobId = ''
let untaggedTranscriptionJobId = ''
let transcriptionArtifactId = ''

beforeAll(async () => {
  const password = 'session-jobs-test-password'
  const passwordHash = await new Hash(new Scrypt({})).make(password)
  const owner = db.insert(tables.user).values({ email: 'jobs-owner@example.com', name: 'Jobs Owner', passwordHash }).returning().get()!
  const outsider = db.insert(tables.user).values({ email: 'jobs-other@example.com', name: 'Other Owner', passwordHash }).returning().get()!
  const campaign = db.insert(tables.campaign).values({ ownerId: owner.id, name: 'Jobs campaign' }).returning().get()!
  campaignId = campaign.id
  const session = db.insert(tables.session).values({ campaignId, title: 'Jobs session' }).returning().get()!
  sessionId = session.id
  const recordingArtifact = db.insert(tables.artifact).values({
    ownerId: owner.id,
    campaignId,
    provider: 'LOCAL',
    storageKey: `session-jobs/${session.id}/recording.mp3`,
    mimeType: 'audio/mpeg',
    byteSize: 512,
  }).returning().get()!
  const recording = db.insert(tables.recording).values({
    sessionId,
    kind: 'AUDIO',
    filename: 'jobs-recording.mp3',
    mimeType: 'audio/mpeg',
    byteSize: 512,
    artifactId: recordingArtifact.id,
  }).returning().get()!
  recordingId = recording.id
  const taggedJob = db.insert(tables.transcriptionJob).values({
    recordingId,
    provider: 'ELEVENLABS',
    status: 'COMPLETED',
    modelId: 'scribe-v1',
    languageCode: 'en',
    numSpeakers: 2,
    diarize: true,
    tagAudioEvents: true,
    requestedFormats: JSON.stringify(['txt', 'srt']),
    keyterms: JSON.stringify(['Aelar']),
    completedAt: new Date('2026-09-10T00:00:00Z'),
    createdAt: new Date('2026-09-10T00:00:00Z'),
  }).returning().get()!
  taggedTranscriptionJobId = taggedJob.id
  const transcriptionArtifact = db.insert(tables.artifact).values({
    ownerId: owner.id,
    campaignId,
    provider: 'LOCAL',
    storageKey: `session-jobs/${session.id}/transcript.txt`,
    mimeType: 'text/plain',
    byteSize: 64,
    label: 'Private transcription artifact label',
  }).returning().get()!
  transcriptionArtifactId = transcriptionArtifact.id
  db.insert(tables.transcriptionArtifact).values({
    transcriptionJobId: taggedJob.id,
    artifactId: transcriptionArtifact.id,
    format: 'TXT',
  }).returning().get()!
  const untaggedJob = db.insert(tables.transcriptionJob).values({
    recordingId,
    provider: 'ELEVENLABS',
    status: 'FAILED',
    diarize: false,
    tagAudioEvents: false,
    requestedFormats: 'not-json',
    keyterms: JSON.stringify({ invalid: 'array' }),
    errorMessage: 'Transcription failed',
    createdAt: new Date('2026-09-11T00:00:00Z'),
  }).returning().get()!
  untaggedTranscriptionJobId = untaggedJob.id
  emptySessionId = (db.insert(tables.session).values({ campaignId, title: 'Empty' }).returning().get()!).id
  const hiddenCampaign = db.insert(tables.campaign).values({ ownerId: outsider.id, name: 'Other campaign' }).returning().get()!
  hiddenSessionId = (db.insert(tables.session).values({ campaignId: hiddenCampaign.id, title: 'Hidden' }).returning().get()!).id
  const hiddenDocument = db.insert(tables.document).values({ campaignId: hiddenCampaign.id, sessionId: hiddenSessionId, type: 'TRANSCRIPT', title: 'Hidden transcript' }).returning().get()!
  const hiddenJob = db.insert(tables.summaryJob).values({
    campaignId: hiddenCampaign.id, sessionId: hiddenSessionId, documentId: hiddenDocument.id,
    trackingId: 'hidden-job', kind: 'SUMMARY_GENERATION', mode: 'ASYNC', status: 'READY_FOR_REVIEW',
  }).returning().get()!
  db.insert(tables.summarySuggestion).values({ summaryJobId: hiddenJob.id, entityType: 'QUEST', action: 'CREATE', payload: { title: 'Hidden quest' } }).run()
  documentId = (db.insert(tables.document).values({ campaignId, sessionId, type: 'TRANSCRIPT', title: 'Transcript' }).returning().get()!).id
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.21' },
    body: JSON.stringify({ email: owner.email, password }),
  })
  expect(login.status).toBe(200)
  cookie = login.headers.get('set-cookie')?.match(/nuxt-session=[^;]+/)?.[0] || ''
}, 120_000)
afterAll(() => db.$client.close())

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
    const job = db.insert(tables.summaryJob).values({
      id, campaignId, sessionId, documentId, trackingId: id, kind, mode: 'ASYNC', status: 'READY_FOR_REVIEW', createdAt,
      meta: { fullSummary: id },
    }).returning().get()!
    db.insert(tables.summarySuggestion).values({ summaryJobId: job.id, entityType: 'QUEST', action: 'CREATE', payload: { title: id } }).run()
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

it('returns matching transcription job DTOs with audio-event flags and safe JSON/artifact fields', async () => {
  const listResponse = await fetch(`${baseUrl}/api/recordings/${recordingId}/transcriptions`, {
    headers: { cookie },
  })
  expect(listResponse.status).toBe(200)
  const listPayload = await listResponse.json()
  expect(listPayload.data.map((job: { id: string }) => job.id)).toEqual([
    untaggedTranscriptionJobId,
    taggedTranscriptionJobId,
  ])

  for (const jobId of [taggedTranscriptionJobId, untaggedTranscriptionJobId]) {
    const detailResponse = await fetch(`${baseUrl}/api/transcriptions/${jobId}`, {
      headers: { cookie },
    })
    expect(detailResponse.status).toBe(200)
    const detailPayload = await detailResponse.json()
    expect(detailPayload.data).toEqual(listPayload.data.find((job: { id: string }) => job.id === jobId))
  }

  const taggedJob = listPayload.data.find((job: { id: string }) => job.id === taggedTranscriptionJobId)
  expect(taggedJob).toMatchObject({
    tagAudioEvents: true,
    requestedFormats: ['txt', 'srt'],
    keyterms: ['Aelar'],
  })
  expect(taggedJob.artifacts).toEqual([{
    id: expect.any(String),
    format: 'TXT',
    artifact: {
      id: transcriptionArtifactId,
      storageKey: `session-jobs/${sessionId}/transcript.txt`,
      mimeType: 'text/plain',
      byteSize: 64,
      createdAt: expect.any(String),
    },
  }])

  const untaggedJob = listPayload.data.find((job: { id: string }) => job.id === untaggedTranscriptionJobId)
  expect(untaggedJob).toMatchObject({
    tagAudioEvents: false,
    requestedFormats: [],
    keyterms: [],
    artifacts: [],
  })

  db.update(tables.transcriptionJob).set({ requestedFormats: null, keyterms: null }).where(eq(tables.transcriptionJob.id, untaggedTranscriptionJobId)).returning().get()!
  const nullJsonResponse = await fetch(`${baseUrl}/api/transcriptions/${untaggedTranscriptionJobId}`, {
    headers: { cookie },
  })
  expect(nullJsonResponse.status).toBe(200)
  const nullJsonPayload = await nullJsonResponse.json()
  expect(nullJsonPayload.data).toMatchObject({ requestedFormats: [], keyterms: [] })
})

it('accepts empty suggestion overrides and retains pending session fields until each is applied', async () => {
  const session = db.insert(tables.session).values({ campaignId, title: 'Original session', notes: 'Original notes' }).returning().get()!
  const document = db.insert(tables.document).values({ campaignId, sessionId: session.id, type: 'TRANSCRIPT', title: 'No-op transcript' }).returning().get()!
  const job = db.insert(tables.summaryJob).values({
    campaignId, sessionId: session.id, documentId: document.id, trackingId: `noop-${session.id}`,
    kind: 'SUGGESTION_GENERATION', mode: 'ASYNC', status: 'READY_FOR_REVIEW',
  }).returning().get()!
  const quest = db.insert(tables.quest).values({ campaignId, title: 'Original quest', description: 'Original description' }).returning().get()!
  const sessionSuggestion = db.insert(tables.summarySuggestion).values({
    summaryJobId: job.id, entityType: 'SESSION', action: 'UPDATE',
    payload: { title: 'Suggested session', notes: 'Suggested notes' },
  }).returning().get()!
  const questSuggestion = db.insert(tables.summarySuggestion).values({
    summaryJobId: job.id, entityType: 'QUEST', action: 'UPDATE', match: { id: quest.id }, payload: { title: 'Suggested quest' },
  }).returning().get()!
  const apply = async (suggestionId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${baseUrl}/api/summaries/suggestions/${suggestionId}`, {
      method: 'PATCH', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'apply', payload }),
    })
    expect(response.status).toBe(200)
    return (await response.json()).data
  }
  try {
    expect(await apply(sessionSuggestion.id, {})).toMatchObject({ entityId: session.id, entityType: 'SESSION', status: 'APPLIED' })
    expect(db.select().from(tables.session).where(eq(tables.session.id, session.id)).get()).toEqual(session)
    expect(db.select().from(tables.summarySuggestion).where(eq(tables.summarySuggestion.id, sessionSuggestion.id)).get()).toMatchObject({
      status: 'PENDING', payload: { title: 'Suggested session', notes: 'Suggested notes' },
    })
    expect(await apply(questSuggestion.id, {})).toMatchObject({ entityId: quest.id, entityType: 'QUEST', status: 'APPLIED' })
    expect(db.select().from(tables.quest).where(eq(tables.quest.id, quest.id)).get()).toEqual(quest)
    expect(db.select().from(tables.summaryJob).where(eq(tables.summaryJob.id, job.id)).get()?.status).toBe('READY_FOR_REVIEW')
    await apply(sessionSuggestion.id, { title: 'Suggested session' })
    expect(db.select().from(tables.session).where(eq(tables.session.id, session.id)).get()).toMatchObject({ title: 'Suggested session', notes: 'Original notes' })
    expect(db.select().from(tables.summarySuggestion).where(eq(tables.summarySuggestion.id, sessionSuggestion.id)).get()).toMatchObject({ status: 'PENDING', payload: { notes: 'Suggested notes' } })
    await apply(sessionSuggestion.id, { notes: 'Suggested notes' })
    expect(db.select().from(tables.session).where(eq(tables.session.id, session.id)).get()).toMatchObject({ title: 'Suggested session', notes: 'Suggested notes' })
    expect(db.select().from(tables.summarySuggestion).where(eq(tables.summarySuggestion.id, sessionSuggestion.id)).get()?.status).toBe('APPLIED')
    expect(db.select().from(tables.summaryJob).where(eq(tables.summaryJob.id, job.id)).get()?.status).toBe('APPLIED')
  } finally {
    db.delete(tables.summaryJob).where(eq(tables.summaryJob.id, job.id)).run()
    db.delete(tables.document).where(eq(tables.document.id, document.id)).run()
    db.delete(tables.session).where(eq(tables.session.id, session.id)).run()
    db.delete(tables.quest).where(eq(tables.quest.id, quest.id)).run()
  }
})
