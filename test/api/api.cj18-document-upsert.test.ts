import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { unlink, writeFile } from 'node:fs/promises'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'

const prisma = createApiTestPrismaClient()
const baseUrl = getApiTestBaseUrl()
let campaignId = ''
let sessionId = ''
let cookie = ''
let userId = ''
let transcriptionStorageKey = ''

const createDocument = (type: 'TRANSCRIPT' | 'SUMMARY' | 'NOTES', title: string, content: string) => fetch(
  `${baseUrl}/api/sessions/${sessionId}/documents`,
  {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ type, title, content, format: 'MARKDOWN' }),
  }
)

const importDocument = (type: 'TRANSCRIPT' | 'SUMMARY' | 'NOTES', title: string, content: string) => {
  const body = new FormData()
  body.append('type', type)
  body.append('title', title)
  body.append('file', new Blob([content], { type: 'text/plain' }), 'session.txt')
  return fetch(`${baseUrl}/api/sessions/${sessionId}/documents/import`, {
    method: 'POST', headers: { cookie }, body,
  })
}

describe('CJ-18 document upsert callers', () => {
  beforeAll(async () => {
    const password = 'cj18-document-upsert-password'
    const user = await prisma.user.create({ data: {
      email: 'cj18-document-upsert@example.com',
      name: 'CJ-18 Document Owner',
      passwordHash: await new Hash(new Scrypt()).make(password),
    } })
    userId = user.id
    const campaign = await prisma.campaign.create({ data: { ownerId: userId, name: 'CJ-18 document campaign' } })
    campaignId = campaign.id
    sessionId = (await prisma.session.create({ data: { campaignId, title: 'CJ-18 session' } })).id
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.218' },
      body: JSON.stringify({ email: user.email, password }),
    })
    expect(login.status).toBe(200)
    cookie = login.headers.get('set-cookie')?.match(/nuxt-session=[^;]+/)?.[0] || ''
  }, 120_000)

  afterAll(async () => {
    if (transcriptionStorageKey) await unlink(`storage/${transcriptionStorageKey}`).catch(() => {})
    if (campaignId) await prisma.campaign.delete({ where: { id: campaignId } })
    if (userId) await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('keeps explicit document creation as a 409 conflict without adding a version', async () => {
    const created = await createDocument('NOTES', 'Explicit notes', 'first notes')
    expect(created.status).toBe(200)
    const { data } = await created.json()

    const duplicate = await createDocument('NOTES', 'Replacement title', 'second notes')
    expect(duplicate.status).toBe(409)
    expect(await duplicate.json()).toMatchObject({ error: { code: 'ALREADY_EXISTS' } })

    const stored = await prisma.document.findUniqueOrThrow({
      where: { id: data.id }, include: { versions: { orderBy: { versionNumber: 'asc' } } },
    })
    expect(stored.title).toBe('Explicit notes')
    expect(stored.versions).toHaveLength(1)
    expect(stored.versions[0]).toMatchObject({ versionNumber: 1, content: 'first notes', source: 'USER_EDIT' })
  })

  it('imports the same session document repeatedly as successive versions while retaining its original title', async () => {
    const first = await importDocument('TRANSCRIPT', 'Imported transcript', 'first import')
    expect(first.status).toBe(200)
    const firstPayload = await first.json()

    const second = await importDocument('TRANSCRIPT', 'Ignored replacement title', 'second import')
    expect(second.status).toBe(200)
    const secondPayload = await second.json()
    expect(secondPayload.data.id).toBe(firstPayload.data.id)

    const stored = await prisma.document.findUniqueOrThrow({
      where: { id: firstPayload.data.id },
      include: { currentVersion: true, versions: { orderBy: { versionNumber: 'asc' } } },
    })
    expect(stored.title).toBe('Imported transcript')
    expect(stored.currentVersion).toMatchObject({
      versionNumber: 2, content: 'second import', format: 'PLAINTEXT', source: 'USER_IMPORT', createdByUserId: userId,
    })
    expect(stored.versions.map(version => ({
      versionNumber: version.versionNumber, content: version.content, format: version.format, source: version.source,
    }))).toEqual([
      { versionNumber: 1, content: 'first import', format: 'PLAINTEXT', source: 'USER_IMPORT' },
      { versionNumber: 2, content: 'second import', format: 'PLAINTEXT', source: 'USER_IMPORT' },
    ])
  })

  it('applies a transcription through the session upsert and associates its recording after updating the document', async () => {
    const recordingArtifact = await prisma.artifact.create({ data: {
      ownerId: userId, campaignId, provider: 'LOCAL', storageKey: `cj18-recording-${sessionId}.mp3`,
      mimeType: 'audio/mpeg', byteSize: 1,
    } })
    const recording = await prisma.recording.create({ data: {
      sessionId, kind: 'AUDIO', filename: 'cj18.mp3', mimeType: 'audio/mpeg', byteSize: 1, artifactId: recordingArtifact.id,
    } })
    const job = await prisma.transcriptionJob.create({ data: {
      recordingId: recording.id, provider: 'ELEVENLABS', status: 'COMPLETED',
    } })
    transcriptionStorageKey = `cj18-transcript-${job.id}.txt`
    await writeFile(`storage/${transcriptionStorageKey}`, 'transcription import')
    const transcriptArtifact = await prisma.artifact.create({ data: {
      ownerId: userId, campaignId, provider: 'LOCAL', storageKey: transcriptionStorageKey,
      mimeType: 'text/plain', byteSize: 20,
    } })
    await prisma.transcriptionArtifact.create({ data: {
      transcriptionJobId: job.id, artifactId: transcriptArtifact.id, format: 'TXT',
    } })

    const applied = await fetch(`${baseUrl}/api/transcriptions/${job.id}`, {
      method: 'PATCH', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'apply-transcript' }),
    })
    expect(applied.status).toBe(200)
    const { data } = await applied.json()
    expect(data.recordingId).toBeNull()
    const transcript = await prisma.document.findUniqueOrThrow({
      where: { id: data.id }, include: { currentVersion: true, versions: { orderBy: { versionNumber: 'asc' } } },
    })
    expect(transcript.title).toBe('Imported transcript')
    expect(transcript.recordingId).toBe(recording.id)
    expect(transcript.currentVersion).toMatchObject({
      versionNumber: 3, content: 'transcription import', format: 'PLAINTEXT', source: 'ELEVENLABS_IMPORT',
    })
    expect(transcript.versions).toHaveLength(3)
  })

  it('applies each summary job as one N8N version and associates both jobs with the retained summary document', async () => {
    const transcript = await prisma.document.findFirstOrThrow({ where: { sessionId, type: 'TRANSCRIPT' } })
    const firstJob = await prisma.summaryJob.create({ data: {
      campaignId, sessionId, documentId: transcript.id, trackingId: 'cj18-summary-first',
      kind: 'SUMMARY_GENERATION', mode: 'ASYNC', status: 'READY_FOR_REVIEW', meta: { summaryContent: 'First summary' },
    } })

    const firstApply = await fetch(`${baseUrl}/api/summaries/jobs/${firstJob.id}`, {
      method: 'PATCH', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'apply' }),
    })
    expect(firstApply.status).toBe(200)
    const { data: firstApplied } = await firstApply.json()
    const summaryId = firstApplied.summaryDocumentId
    expect(summaryId).toEqual(expect.any(String))

    const secondJob = await prisma.summaryJob.create({ data: {
      campaignId, sessionId, documentId: transcript.id, trackingId: 'cj18-summary-second',
      kind: 'SUMMARY_GENERATION', mode: 'ASYNC', status: 'READY_FOR_REVIEW', meta: { summaryContent: 'Second summary' },
    } })
    const secondApply = await fetch(`${baseUrl}/api/summaries/jobs/${secondJob.id}`, {
      method: 'PATCH', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'apply' }),
    })
    expect(secondApply.status).toBe(200)
    const { data: secondApplied } = await secondApply.json()
    expect(secondApplied.summaryDocumentId).toBe(summaryId)

    const summary = await prisma.document.findUniqueOrThrow({
      where: { id: summaryId }, include: { currentVersion: true, versions: { orderBy: { versionNumber: 'asc' } } },
    })
    expect(summary.title).toBe('Summary: CJ-18 session')
    expect(summary.currentVersion).toMatchObject({ versionNumber: 2, content: 'Second summary', format: 'MARKDOWN', source: 'N8N_IMPORT' })
    expect(summary.versions.map(version => ({ versionNumber: version.versionNumber, content: version.content, source: version.source }))).toEqual([
      { versionNumber: 1, content: 'First summary', source: 'N8N_IMPORT' },
      { versionNumber: 2, content: 'Second summary', source: 'N8N_IMPORT' },
    ])
    expect(await prisma.summaryJob.findMany({
      where: { id: { in: [firstJob.id, secondJob.id] } }, select: { summaryDocumentId: true, status: true },
    })).toEqual(expect.arrayContaining([
      { summaryDocumentId: summaryId, status: 'APPLIED' },
      { summaryDocumentId: summaryId, status: 'APPLIED' },
    ]))

    await prisma.summaryJob.update({
      where: { id: secondJob.id }, data: { meta: { summaryContent: 'Reapplied summary' } },
    })
    const reapplied = await fetch(`${baseUrl}/api/summaries/jobs/${secondJob.id}`, {
      method: 'PATCH', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'apply' }),
    })
    expect(reapplied.status).toBe(200)
    expect((await reapplied.json()).data.summaryDocumentId).toBe(summaryId)

    const reloadedSummary = await prisma.document.findUniqueOrThrow({
      where: { id: summaryId }, include: { currentVersion: true, versions: { orderBy: { versionNumber: 'asc' } } },
    })
    expect(reloadedSummary.currentVersion).toMatchObject({
      versionNumber: 3, content: 'Reapplied summary', format: 'MARKDOWN', source: 'N8N_IMPORT',
    })
    expect(reloadedSummary.versions).toHaveLength(3)
  })
})
