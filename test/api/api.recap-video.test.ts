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

  it('uploads, replaces, publishes, streams and deletes recaps without affecting the other media kind', async () => {
    for (const mimeType of ['audio/mpeg', 'video/mp4', 'audio/mpeg', 'video/mp4']) {
      const response = await upload(mimeType)
      expect(response.status).toBe(200)
      const { data } = await response.json()
      const kind = mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO'
      expect(data).toMatchObject({ mimeType, kind })
      if (recapIds[kind]) expect(data.id).toBe(recapIds[kind])
      recapIds[kind] = data.id
      expect(await prisma.recapRecording.count({ where: { sessionId } })).toBe(Object.keys(recapIds).length)
      const playback = await fetch(baseUrl + '/api/recaps/' + data.id + '/playback/url', { headers: { cookie } })
      expect(playback.status).toBe(200)
      const stream = await fetch(baseUrl + (await playback.json()).data.url, { headers: { cookie } })
      expect(stream.status).toBe(200)
      expect(stream.headers.get('content-type')).toContain(mimeType)
      expect(await stream.text()).toBe('recap media bytes')
    }

    for (const path of ['recap', 'workspace']) {
      const response = await fetch(baseUrl + '/api/sessions/' + sessionId + '/' + path, { headers: { cookie } })
      expect(response.status).toBe(200)
      const { data } = await response.json()
      const recaps = path === 'workspace' ? data.recaps : data
      expect(recaps.map((item: { id: string }) => item.id)).toEqual([recapIds.AUDIO, recapIds.VIDEO])
    }
    const video = await prisma.recapRecording.findUniqueOrThrow({ where: { id: recapIds.VIDEO } })
    expect((await upload('text/plain')).status).toBe(400)
    expect(await prisma.recapRecording.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({ artifactId: video.artifactId })

    const settings = await fetch(baseUrl + '/api/campaigns/' + campaignId + '/public/access', {
      method: 'PATCH', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ isEnabled: true, showRecaps: true }),
    })
    expect(settings.status).toBe(200)
    const publicSlug = (await settings.json()).data.publicSlug
    const publicRecaps = await fetch(baseUrl + '/api/public/campaigns/' + publicSlug + '/recaps')
    expect(publicRecaps.status).toBe(200)
    expect((await publicRecaps.json()).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: recapIds.VIDEO, mimeType: 'video/mp4' }),
      expect.objectContaining({ id: recapIds.AUDIO, mimeType: 'audio/mpeg' }),
    ]))

    // The parser matrix lives in media-stream.test.ts; exercise each HTTP contract here.
    const privateUrl = baseUrl + '/api/artifacts/' + video.artifactId + '/stream'
    const publicUrl = baseUrl + '/api/public/campaigns/' + publicSlug + '/recaps/' + video.id + '/stream'
    for (const url of [privateUrl, publicUrl]) {
      const headers = url === privateUrl ? { cookie } : {}
      const full = await fetch(url, { headers })
      expect(full.status).toBe(200)
      expect(full.headers.get('content-type')).toContain('video/mp4')
      expect(full.headers.get('accept-ranges')).toBe('bytes')
      expect(full.headers.get('content-length')).toBe('17')
      expect(await full.text()).toBe('recap media bytes')

      const ranged = await fetch(url, { headers: { ...headers, range: 'bytes=12-999' } })
      expect(ranged.status).toBe(206)
      expect(ranged.headers.get('content-range')).toBe('bytes 12-16/17')
      expect(ranged.headers.get('content-length')).toBe('5')
      expect(await ranged.text()).toBe('bytes')

      const invalid = await fetch(url, { headers: { ...headers, range: 'bytes=999-' } })
      expect(invalid.status).toBe(416)
      expect(invalid.headers.get('content-range')).toBe('bytes */17')
      if (url === privateUrl) {
        expect(invalid.headers.get('content-type')).toContain('application/json')
        expect(await invalid.json()).toEqual({
          data: null, error: { code: 'RANGE_NOT_SATISFIABLE', message: 'Requested range is not satisfiable.' },
        })
      } else {
        expect(await invalid.text()).toBe('')
      }
    }
    const fallback = await fetch(privateUrl, { headers: { cookie, range: 'not-a-range' } })
    expect(fallback.status).toBe(200)
    expect(await fallback.text()).toBe('recap media bytes')
    const denied = await fetch(privateUrl, { headers: { cookie: outsiderCookie, range: 'bytes=999-' } })
    expect(denied.status).toBe(403)
    expect(denied.headers.get('content-range')).toBeNull()
    expect(await denied.json()).toMatchObject({ data: null, error: { code: 'FORBIDDEN' } })

    expect((await fetch(baseUrl + '/api/recaps/' + recapIds.AUDIO, { method: 'DELETE', headers: { cookie } })).status).toBe(200)
    expect(await prisma.recapRecording.count({ where: { sessionId } })).toBe(1)
    const retained = await fetch(privateUrl, { headers: { cookie } })
    expect(retained.status).toBe(200)
    expect(await retained.text()).toBe('recap media bytes')
    delete recapIds.AUDIO
  })
})
