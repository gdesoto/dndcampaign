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
    ownerId, campaignId, provider: 'LOCAL', storageKey: `cj19-recording-${suffix}`,
    mimeType: kind === 'VIDEO' ? 'video/mp4' : 'audio/mpeg', byteSize: 1,
  } })
  return prisma.recording.create({ data: {
    sessionId, kind, filename: `cj19-${suffix}`, mimeType: artifact.mimeType, byteSize: 1, artifactId: artifact.id,
  } })
}

const createTranscriptArtifact = async (format: 'TXT' | 'SRT', content: string) => {
  const storageKey = `cj19-${format.toLowerCase()}-${crypto.randomUUID()}.${format.toLowerCase()}`
  storageKeys.push(storageKey)
  await writeFile(`storage/${storageKey}`, content)
  return prisma.artifact.create({ data: {
    ownerId, campaignId, provider: 'LOCAL', storageKey,
    mimeType: format === 'SRT' ? 'text/srt' : 'text/plain', byteSize: Buffer.byteLength(content),
  } })
}

describe('CJ-19 local transcript application and subtitles', () => {
  beforeAll(async () => {
    const password = 'cj19-transcription-local-password'
    const passwordHash = await new Hash(new Scrypt()).make(password)
    const [owner, viewer] = await Promise.all([
      prisma.user.create({ data: { email: 'cj19-transcription-owner@example.com', name: 'CJ-19 Owner', passwordHash } }),
      prisma.user.create({ data: { email: 'cj19-transcription-viewer@example.com', name: 'CJ-19 Viewer', passwordHash } }),
    ])
    ownerId = owner.id
    viewerId = viewer.id
    const campaign = await prisma.campaign.create({ data: {
      ownerId, name: 'CJ-19 transcription campaign',
      members: { create: { userId: viewerId, role: 'VIEWER', invitedByUserId: ownerId } },
    } })
    campaignId = campaign.id
    const [session, otherSession] = await Promise.all([
      prisma.session.create({ data: { campaignId, title: 'CJ-19 session' } }),
      prisma.session.create({ data: { campaignId, title: 'CJ-19 other session' } }),
    ])
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
    ownerCookie = await login('cj19-transcription-owner@example.com')
    viewerCookie = await login('cj19-transcription-viewer@example.com')
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
})
