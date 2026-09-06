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
let recapId = ''
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
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.91' },
      body: JSON.stringify({ email: user.email, password }),
    })
    expect(response.status).toBe(200)
    cookie = response.headers.get('set-cookie') || ''
  })

  afterAll(async () => {
    for (const id of Object.values(recapIds)) {
      await fetch(`${baseUrl}/api/recaps/${id}`, { method: 'DELETE', headers: { cookie } })
    }
    if (campaignId) await prisma.campaign.delete({ where: { id: campaignId } })
    if (userId) await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('keeps both recap kinds, replaces only the matching kind, and streams each independently', async () => {
    for (const mimeType of ['audio/mpeg', 'video/mp4', 'video/webm', 'video/ogg', 'audio/mpeg']) {
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
      if (mimeType === 'video/mp4') {
        const settings = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public/access`, {
          method: 'PATCH', headers: { cookie, 'content-type': 'application/json' },
          body: JSON.stringify({ isEnabled: true, showRecaps: true }),
        })
        expect(settings.status).toBe(200)
        const { data: access } = await settings.json()
        const publicRecaps = await fetch(`${baseUrl}/api/public/campaigns/${access.publicSlug}/recaps`)
        expect(publicRecaps.status).toBe(200)
        expect((await publicRecaps.json()).data).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: recapId, mimeType: 'video/mp4' }),
          expect.objectContaining({ id: recapIds.AUDIO, mimeType: 'audio/mpeg' }),
        ]))
        const publicStream = await fetch(`${baseUrl}/api/public/campaigns/${access.publicSlug}/recaps/${recapId}/stream`)
        expect(publicStream.status).toBe(200)
        expect(publicStream.headers.get('content-type')).toContain('video/mp4')
        expect(await publicStream.text()).toBe('recap media bytes')
        const ranged = await fetch(`${baseUrl}/api/public/campaigns/${access.publicSlug}/recaps/${recapId}/stream`, { headers: { range: 'bytes=6-10' } })
        expect(ranged.status).toBe(206)
        expect(ranged.headers.get('content-range')).toBe('bytes 6-10/17')
        expect(await ranged.text()).toBe('media')
        const invalid = await fetch(`${baseUrl}/api/public/campaigns/${access.publicSlug}/recaps/${recapId}/stream`, { headers: { range: 'bytes=999-' } })
        expect(invalid.status).toBe(416)
        expect(invalid.headers.get('content-range')).toBe('bytes */17')
        await invalid.text()
      }
    }
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

