import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'

const prisma = createApiTestPrismaClient()
const baseUrl = getApiTestBaseUrl()
let ownerId = ''
let viewerId = ''
let campaignId = ''
let jobId = ''
let documentSessionId = ''
let textArtifactId = ''
let subtitleArtifactId = ''
let foreignArtifactId = ''
let sourceRecordingId = ''
let videoRecordingId = ''
let audioRecordingId = ''
let otherSessionVideoRecordingId = ''
let ownerCookie = ''
let viewerCookie = ''
const storageKeys: string[] = []

const request = (cookie: string, action: Record<string, string>) => fetch(`${baseUrl}/api/transcriptions/${jobId}`, {
  method: 'PATCH',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify(action),
})

const createRecording = async (sessionId: string, kind: 'AUDIO' | 'VIDEO', suffix: string) => {
  const artifact = await prisma.artifact.create({ data: {
    ownerId, campaignId, provider: 'LOCAL', storageKey: `documents-recording-${suffix}`,
    mimeType: kind === 'VIDEO' ? 'video/mp4' : 'audio/mpeg', byteSize: 1,
  } })
  return prisma.recording.create({ data: {
    sessionId, kind, filename: `documents-${suffix}`, mimeType: artifact.mimeType, byteSize: 1, artifactId: artifact.id,
  } })
}

const createTranscriptArtifact = async (format: 'TXT' | 'SRT', content: string) => {
  const storageKey = `documents-${format.toLowerCase()}-${crypto.randomUUID()}.${format.toLowerCase()}`
  storageKeys.push(storageKey)
  await writeFile(`storage/${storageKey}`, content)
  return prisma.artifact.create({ data: {
    ownerId, campaignId, provider: 'LOCAL', storageKey,
    mimeType: format === 'SRT' ? 'text/srt' : 'text/plain', byteSize: Buffer.byteLength(content),
  } })
}

const createDocument = (type: 'TRANSCRIPT' | 'SUMMARY' | 'NOTES', title: string, content: string) => fetch(
  `${baseUrl}/api/sessions/${documentSessionId}/documents`,
  {
    method: 'POST',
    headers: { cookie: ownerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ type, title, content, format: 'MARKDOWN' }),
  }
)

const importDocument = (type: 'TRANSCRIPT' | 'SUMMARY' | 'NOTES', title: string, content: string) => {
  const body = new FormData()
  body.append('type', type)
  body.append('title', title)
  body.append('file', new Blob([content], { type: 'text/plain' }), 'session.txt')
  return fetch(`${baseUrl}/api/sessions/${documentSessionId}/documents/import`, {
    method: 'POST', headers: { cookie: ownerCookie }, body,
  })
}

describe('session documents, transcription and subtitles', () => {
  beforeAll(async () => {
    const password = 'documents-transcription-local-password'
    const passwordHash = await new Hash(new Scrypt()).make(password)
    const [owner, viewer] = await Promise.all([
      prisma.user.create({ data: { email: 'documents-transcription-owner@example.com', name: 'Document Owner', passwordHash } }),
      prisma.user.create({ data: { email: 'documents-transcription-viewer@example.com', name: 'Document Viewer', passwordHash } }),
    ])
    ownerId = owner.id
    viewerId = viewer.id
    const campaign = await prisma.campaign.create({ data: {
      ownerId, name: 'Document transcription campaign',
      members: { create: { userId: viewerId, role: 'VIEWER', invitedByUserId: ownerId } },
    } })
    campaignId = campaign.id
    const [session, otherSession] = await Promise.all([
      prisma.session.create({ data: { campaignId, title: 'Document session' } }),
      prisma.session.create({ data: { campaignId, title: 'Document other session' } }),
    ])
    documentSessionId = (await prisma.session.create({ data: { campaignId, title: 'Document imports' } })).id
    sourceRecordingId = (await createRecording(session.id, 'AUDIO', 'source')).id
    videoRecordingId = (await createRecording(session.id, 'VIDEO', 'video')).id
    audioRecordingId = (await createRecording(session.id, 'AUDIO', 'audio')).id
    otherSessionVideoRecordingId = (await createRecording(otherSession.id, 'VIDEO', 'other-video')).id
    jobId = (await prisma.transcriptionJob.create({ data: {
      recordingId: sourceRecordingId, provider: 'ELEVENLABS', status: 'COMPLETED',
    } })).id

    const textArtifact = await createTranscriptArtifact('TXT', 'First local transcript')
    textArtifactId = textArtifact.id
    const subtitleArtifact = await createTranscriptArtifact('SRT', '1\n00:00:00,000 --> 00:00:01,000\nHello from subtitles\n')
    subtitleArtifactId = subtitleArtifact.id
    const foreignArtifact = await createTranscriptArtifact('TXT', 'Unlinked artifact')
    foreignArtifactId = foreignArtifact.id
    await prisma.transcriptionArtifact.createMany({ data: [
      { transcriptionJobId: jobId, artifactId: textArtifactId, format: 'TXT' },
      { transcriptionJobId: jobId, artifactId: subtitleArtifactId, format: 'SRT' },
    ] })

    const login = async (email: string) => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.219' },
        body: JSON.stringify({ email, password }),
      })
      expect(response.status).toBe(200)
      return response.headers.get('set-cookie')?.match(/nuxt-session=[^;]+/)?.[0] || ''
    }
    ownerCookie = await login('documents-transcription-owner@example.com')
    viewerCookie = await login('documents-transcription-viewer@example.com')
  }, 120_000)

  afterAll(async () => {
    await Promise.all(storageKeys.map((key) => unlink(`storage/${key}`).catch(() => {})))
    if (campaignId) await prisma.campaign.delete({ where: { id: campaignId } })
    if (ownerId || viewerId) await prisma.artifact.deleteMany({ where: { ownerId: { in: [ownerId, viewerId] } } })
    if (viewerId) await prisma.user.delete({ where: { id: viewerId } })
    if (ownerId) await prisma.user.delete({ where: { id: ownerId } })
    await prisma.$disconnect()
  })

  it('applies the TXT fallback and updates the retained transcript without an ElevenLabs key', async () => {
    const first = await request(ownerCookie, { action: 'apply-transcript' })
    expect(first.status).toBe(200)
    const firstPayload = await first.json()
    expect(firstPayload.data.recordingId).toBe(sourceRecordingId)

    await writeFile(`storage/${storageKeys[0]}`, 'Updated local transcript')
    const second = await request(ownerCookie, { action: 'apply-transcript', artifactId: textArtifactId })
    expect(second.status).toBe(200)
    expect((await second.json()).data.id).toBe(firstPayload.data.id)

    const document = await prisma.document.findUniqueOrThrow({
      where: { id: firstPayload.data.id }, include: { currentVersion: true, versions: { orderBy: { versionNumber: 'asc' } } },
    })
    expect(document.recordingId).toBe(sourceRecordingId)
    expect(document.currentVersion).toMatchObject({ content: 'Updated local transcript', source: 'ELEVENLABS_IMPORT' })
    expect(document.versions).toHaveLength(2)
  })

  it('attaches converted SRT subtitles only to a video in the transcription session', async () => {
    const attached = await request(ownerCookie, {
      action: 'attach-vtt', artifactId: subtitleArtifactId, recordingId: videoRecordingId,
    })
    expect(attached.status).toBe(200)
    const payload = await attached.json()
    expect(payload.data).toMatchObject({ id: videoRecordingId, vttArtifactId: expect.any(String) })

    const vttArtifact = await prisma.artifact.findUniqueOrThrow({ where: { id: payload.data.vttArtifactId } })
    expect(vttArtifact.ownerId).toBe(ownerId)
    expect(vttArtifact.mimeType).toBe('text/vtt')
    storageKeys.push(vttArtifact.storageKey)
    expect(await readFile(`storage/${vttArtifact.storageKey}`, 'utf8')).toContain(
      'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello from subtitles'
    )
  })

  it('rejects invalid or foreign subtitle artifacts, non-video targets, cross-session targets, and denied writers', async () => {
    for (const action of [
      { action: 'attach-vtt', artifactId: textArtifactId, recordingId: videoRecordingId },
      { action: 'attach-vtt', artifactId: foreignArtifactId, recordingId: videoRecordingId },
      { action: 'attach-vtt', artifactId: subtitleArtifactId, recordingId: audioRecordingId },
      { action: 'attach-vtt', artifactId: subtitleArtifactId, recordingId: otherSessionVideoRecordingId },
    ] as const) {
      const response = await request(ownerCookie, action)
      expect(response.status).toBe(action.recordingId === audioRecordingId ? 400 : 404)
    }

    const foreignApply = await request(ownerCookie, { action: 'apply-transcript', artifactId: foreignArtifactId })
    expect(foreignApply.status).toBe(404)
    const denied = await request(viewerCookie, { action: 'apply-transcript' })
    expect(denied.status).toBe(404)
    const deniedAttach = await request(viewerCookie, {
      action: 'attach-vtt', artifactId: subtitleArtifactId, recordingId: videoRecordingId,
    })
    expect(deniedAttach.status).toBe(404)
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

  it('imports successive versions and applies a transcription without replacing the document', async () => {
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
      versionNumber: 2, content: 'second import', format: 'PLAINTEXT', source: 'USER_IMPORT', createdByUserId: ownerId,
    })
    expect(stored.versions.map(version => ({
      versionNumber: version.versionNumber, content: version.content, format: version.format, source: version.source,
    }))).toEqual([
      { versionNumber: 1, content: 'first import', format: 'PLAINTEXT', source: 'USER_IMPORT' },
      { versionNumber: 2, content: 'second import', format: 'PLAINTEXT', source: 'USER_IMPORT' },
    ])
    const recording = await createRecording(documentSessionId, 'AUDIO', 'import-source')
    const job = await prisma.transcriptionJob.create({ data: {
      recordingId: recording.id, provider: 'ELEVENLABS', status: 'COMPLETED',
    } })
    const transcriptArtifact = await createTranscriptArtifact('TXT', 'transcription import')
    await prisma.transcriptionArtifact.create({ data: {
      transcriptionJobId: job.id, artifactId: transcriptArtifact.id, format: 'TXT',
    } })

    const applied = await fetch(`${baseUrl}/api/transcriptions/${job.id}`, {
      method: 'PATCH', headers: { cookie: ownerCookie, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'apply-transcript' }),
    })
    expect(applied.status).toBe(200)
    const { data } = await applied.json()
    expect(data.id).toBe(firstPayload.data.id)
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
    const transcript = await prisma.document.findFirstOrThrow({ where: { sessionId: documentSessionId, type: 'TRANSCRIPT' } })
    const firstJob = await prisma.summaryJob.create({ data: {
      campaignId, sessionId: documentSessionId, documentId: transcript.id, trackingId: 'document-import-summary-first',
      kind: 'SUMMARY_GENERATION', mode: 'ASYNC', status: 'READY_FOR_REVIEW', meta: { summaryContent: 'First summary' },
    } })

    const firstApply = await fetch(`${baseUrl}/api/summaries/jobs/${firstJob.id}`, {
      method: 'PATCH', headers: { cookie: ownerCookie, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'apply' }),
    })
    expect(firstApply.status).toBe(200)
    const { data: firstApplied } = await firstApply.json()
    const summaryId = firstApplied.summaryDocumentId
    expect(summaryId).toEqual(expect.any(String))

    const secondJob = await prisma.summaryJob.create({ data: {
      campaignId, sessionId: documentSessionId, documentId: transcript.id, trackingId: 'document-import-summary-second',
      kind: 'SUMMARY_GENERATION', mode: 'ASYNC', status: 'READY_FOR_REVIEW', meta: { summaryContent: 'Second summary' },
    } })
    const secondApply = await fetch(`${baseUrl}/api/summaries/jobs/${secondJob.id}`, {
      method: 'PATCH', headers: { cookie: ownerCookie, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'apply' }),
    })
    expect(secondApply.status).toBe(200)
    const { data: secondApplied } = await secondApply.json()
    expect(secondApplied.summaryDocumentId).toBe(summaryId)

    const summary = await prisma.document.findUniqueOrThrow({
      where: { id: summaryId }, include: { currentVersion: true, versions: { orderBy: { versionNumber: 'asc' } } },
    })
    expect(summary.title).toBe('Summary: Document imports')
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
      method: 'PATCH', headers: { cookie: ownerCookie, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'apply' }),
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
