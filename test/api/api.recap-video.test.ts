import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'

const prisma = createApiTestPrismaClient()
const baseUrl = getApiTestBaseUrl()
let userId = ''
let campaignId = ''
let sessionId = ''
let cookie = ''
let outsiderId = ''
let outsiderCookie = ''
let recapId = ''
let publicSlug = ''
const recapIds: Record<string, string> = {}

const upload = (mimeType: string) => {
  const body = new FormData()
  body.append('file', new Blob(['recap media bytes'], { type: mimeType }), 'recap')
  return fetch(`${baseUrl}/api/sessions/${sessionId}/recap`, { method: 'POST', headers: { cookie }, body })
}

describe('audio and video session recaps', () => {
  beforeAll(async () => {
    const password = 'recap-video-password-12345'
    const user = await prisma.user.create({ data: {
      email: 'recap-video@example.com', name: 'Recap Owner',
      passwordHash: await new Hash(new Scrypt()).make(password),
    } })
    userId = user.id
    const campaign = await prisma.campaign.create({ data: {
      ownerId: userId, name: 'Video recap campaign', system: 'D&D 5e',
      members: { create: { userId, role: 'OWNER', invitedByUserId: userId } },
    } })
    campaignId = campaign.id
    const session = await prisma.session.create({ data: { campaignId, title: 'Video session' } })
    sessionId = session.id
    const outsider = await prisma.user.create({ data: {
      email: 'recap-video-outsider@example.com', name: 'Recap Outsider',
      passwordHash: await new Hash(new Scrypt()).make(password),
    } })
    outsiderId = outsider.id
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.91' },
      body: JSON.stringify({ email: user.email, password }),
    })
    expect(response.status).toBe(200)
    cookie = response.headers.get('set-cookie') || ''
    const outsiderLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.92' },
      body: JSON.stringify({ email: outsider.email, password }),
    })
    expect(outsiderLogin.status).toBe(200)
    outsiderCookie = outsiderLogin.headers.get('set-cookie') || ''
  })

  afterAll(async () => {
    for (const id of Object.values(recapIds)) {
      await fetch(`${baseUrl}/api/recaps/${id}`, { method: 'DELETE', headers: { cookie } })
    }
    if (campaignId) await prisma.campaign.delete({ where: { id: campaignId } })
    if (userId) await prisma.user.delete({ where: { id: userId } })
    if (outsiderId) await prisma.user.delete({ where: { id: outsiderId } })
    await prisma.$disconnect()
  })

  it('keeps both recap kinds, replaces only the matching kind, and streams each independently', async () => {
    for (const mimeType of ['audio/mpeg', 'video/mp4', 'audio/mpeg', 'video/mp4']) {
      const response = await upload(mimeType)
      expect(response.status).toBe(200)
      const { data } = await response.json()
      expect(data.mimeType).toBe(mimeType)
      const kind = mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO'
      expect(data.kind).toBe(kind)
      if (recapIds[kind]) expect(data.id).toBe(recapIds[kind])
      recapIds[kind] = data.id
      recapId = data.id
      expect(await prisma.recapRecording.count({ where: { sessionId } })).toBe(Object.keys(recapIds).length)
      const otherKind = kind === 'AUDIO' ? 'VIDEO' : 'AUDIO'
      if (recapIds[otherKind]) {
        expect(await prisma.recapRecording.findUnique({ where: { id: recapIds[otherKind] } })).not.toBeNull()
        expect(recapIds[otherKind]).not.toBe(data.id)
      }
      const playback = await fetch(`${baseUrl}/api/recaps/${recapId}/playback/url`, { headers: { cookie } })
      const payload = await playback.json()
      const stream = await fetch(`${baseUrl}${payload.data.url}`, { headers: { cookie, range: 'bytes=0-4' } })
      expect(stream.status).toBe(206)
      expect(stream.headers.get('content-type')).toContain(mimeType)
      expect(await stream.text()).toBe('recap')
      if (mimeType === 'video/mp4' && !publicSlug) {
        const settings = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public/access`, {
          method: 'PATCH', headers: { cookie, 'content-type': 'application/json' },
          body: JSON.stringify({ isEnabled: true, showRecaps: true }),
        })
        expect(settings.status).toBe(200)
        const { data: access } = await settings.json()
        publicSlug = access.publicSlug
        const publicRecaps = await fetch(`${baseUrl}/api/public/campaigns/${access.publicSlug}/recaps`)
        expect(publicRecaps.status).toBe(200)
        expect((await publicRecaps.json()).data).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: recapId, mimeType: 'video/mp4' }),
          expect.objectContaining({ id: recapIds.AUDIO, mimeType: 'audio/mpeg' }),
        ]))
        const ranged = await fetch(`${baseUrl}/api/public/campaigns/${access.publicSlug}/recaps/${recapId}/stream`, { headers: { range: 'bytes=6-10' } })
        expect(ranged.status).toBe(206)
        expect(ranged.headers.get('content-type')).toContain('video/mp4')
        expect(ranged.headers.get('content-range')).toBe('bytes 6-10/17')
        expect(await ranged.text()).toBe('media')
      }
    }
  })

  it('streams the full public video recap', async () => {
    const response = await fetch(`${baseUrl}/api/public/campaigns/${publicSlug}/recaps/${recapIds.VIDEO}/stream`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('video/mp4')
    expect(await response.text()).toBe('recap media bytes')
  })

  it('streams the full private recap with its MIME type and bytes', async () => {
    const recap = await prisma.recapRecording.findUniqueOrThrow({ where: { id: recapIds.VIDEO } })
    const response = await fetch(`${baseUrl}/api/artifacts/${recap.artifactId}/stream`, { headers: { cookie } })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('video/mp4')
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(response.headers.get('content-length')).toBe('17')
    expect(await response.text()).toBe('recap media bytes')
  })

  it.each([
    ['bytes=6-10', 'bytes 6-10/17', '5', 'media'],
    ['bytes=-5', 'bytes 12-16/17', '5', 'bytes'],
    ['bytes=12-999', 'bytes 12-16/17', '5', 'bytes'],
  ])('streams and clamps private range %s', async (range, contentRange, contentLength, body) => {
    const recap = await prisma.recapRecording.findUniqueOrThrow({ where: { id: recapIds.VIDEO } })
    const response = await fetch(`${baseUrl}/api/artifacts/${recap.artifactId}/stream`, {
      headers: { cookie, range },
    })

    expect(response.status).toBe(206)
    expect(response.headers.get('content-type')).toContain('video/mp4')
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(response.headers.get('content-range')).toBe(contentRange)
    expect(response.headers.get('content-length')).toBe(contentLength)
    expect(await response.text()).toBe(body)
  })

  it.each(['bytes=6-10,12-16', 'not-a-range'])('falls back to full private streaming for malformed range %s', async (range) => {
    const recap = await prisma.recapRecording.findUniqueOrThrow({ where: { id: recapIds.VIDEO } })
    const response = await fetch(`${baseUrl}/api/artifacts/${recap.artifactId}/stream`, {
      headers: { cookie, range },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-length')).toBe('17')
    expect(await response.text()).toBe('recap media bytes')
  })

  it.each([
    'bytes=999-',
    'bytes=10-9',
    'bytes=-0',
    'bytes=9007199254740992-',
    'bytes=0-9007199254740992',
    'bytes=-9007199254740992',
  ])('rejects unsatisfiable private range %s with the API envelope', async (range) => {
    const recap = await prisma.recapRecording.findUniqueOrThrow({ where: { id: recapIds.VIDEO } })
    const response = await fetch(`${baseUrl}/api/artifacts/${recap.artifactId}/stream`, {
      headers: { cookie, range },
    })

    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe('bytes */17')
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({
      data: null,
      error: { code: 'RANGE_NOT_SATISFIABLE', message: 'Requested range is not satisfiable.' },
    })
  })

  it('rejects private artifact streaming before attempting an invalid range for an outsider', async () => {
    const recap = await prisma.recapRecording.findUniqueOrThrow({ where: { id: recapIds.VIDEO } })
    const response = await fetch(`${baseUrl}/api/artifacts/${recap.artifactId}/stream`, {
      headers: { cookie: outsiderCookie, range: 'bytes=999-' },
    })

    expect(response.status).toBe(403)
    expect(response.headers.get('content-range')).toBeNull()
    expect(await response.json()).toEqual({
      data: null,
      error: { code: 'FORBIDDEN', message: 'Artifact access is denied' },
    })
  })

  it.each([
    'bytes=999-',
    'bytes=9007199254740992-',
    'bytes=0-9007199254740992',
    'bytes=-9007199254740992',
    'bytes=-0',
  ])('rejects unsafe public recap range %s', async (range) => {
    const response = await fetch(`${baseUrl}/api/public/campaigns/${publicSlug}/recaps/${recapIds.VIDEO}/stream`, { headers: { range } })
    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe('bytes */17')
    expect(await response.text()).toBe('')
  })

  it.each(['video/webm', 'video/ogg'])('supports uploading and streaming %s recaps', async (mimeType) => {
    const response = await upload(mimeType)
    expect(response.status).toBe(200)
    const { data } = await response.json()
    expect(data.mimeType).toBe(mimeType)
    expect(data.kind).toBe('VIDEO')
    expect(data.id).toBe(recapIds.VIDEO)
    const playback = await fetch(`${baseUrl}/api/recaps/${data.id}/playback/url`, { headers: { cookie } })
    expect(playback.status).toBe(200)
    const payload = await playback.json()
    const stream = await fetch(`${baseUrl}${payload.data.url}`, { headers: { cookie, range: 'bytes=0-4' } })
    expect(stream.status).toBe(206)
    expect(stream.headers.get('content-type')).toContain(mimeType)
    expect(await stream.text()).toBe('recap')
  })

  it('returns both recaps in the session list and workspace', async () => {
    for (const path of ['recap', 'workspace']) {
      const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/${path}`, { headers: { cookie } })
      expect(response.status).toBe(200)
      const { data } = await response.json()
      const recaps = path === 'workspace' ? data.recaps : data
      expect(recaps).toHaveLength(2)
      expect(recaps.map((item: { id: string }) => item.id)).toEqual([recapIds.AUDIO, recapIds.VIDEO])
    }
  })

  it('rejects unsupported files without replacing the recap', async () => {
    const response = await upload('text/plain')
    expect(response.status).toBe(400)
    expect(await prisma.recapRecording.count({ where: { sessionId } })).toBe(2)
  })
  it('deletes audio without removing or breaking video playback', async () => {
    const response = await fetch(`${baseUrl}/api/recaps/${recapIds.AUDIO}`, { method: 'DELETE', headers: { cookie } })
    expect(response.status).toBe(200)
    expect(await prisma.recapRecording.count({ where: { sessionId } })).toBe(1)
    const video = await prisma.recapRecording.findUnique({ where: { id: recapIds.VIDEO } })
    expect(video?.kind).toBe('VIDEO')
    const stream = await fetch(`${baseUrl}/api/artifacts/${video?.artifactId}/stream`, { headers: { cookie } })
    expect(stream.status).toBe(200)
    expect(await stream.text()).toBe('recap media bytes')
    delete recapIds.AUDIO
  })
})

