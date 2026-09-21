// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'

const prisma = createApiTestPrismaClient()
const hash = new Hash(new Scrypt())
const baseUrl = getApiTestBaseUrl()
const password = 'password123'
const email = 'transcript-reader-api@example.com'

describe('agent transcript reader API', () => {
  let campaignId = ''
  let sessionId = ''
  let latestVersionId = ''
  let foreignVersionId = ''
  let bearer = ''
  let deniedBearer = ''

  beforeAll(async () => {
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash: await hash.make(password), name: 'Transcript API User' },
      create: { email, passwordHash: await hash.make(password), name: 'Transcript API User' },
    })
    const campaign = await prisma.campaign.create({
      data: { ownerId: user.id, name: 'Transcript Reader Campaign', system: 'D&D 5e' },
    })
    campaignId = campaign.id
    const session = await prisma.session.create({
      data: { campaignId, title: 'Transcript Reader Session', sessionNumber: 1 },
    })
    sessionId = session.id
    const document = await prisma.document.create({
      data: { campaignId, sessionId, type: 'TRANSCRIPT', title: 'Transcript' },
    })
    await prisma.documentVersion.create({
      data: { documentId: document.id, versionNumber: 1, content: 'old line', format: 'PLAINTEXT' },
    })
    const latest = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: 2,
        content: 'First line\n\nThe dragon appears\nThe dragon retreats',
        format: 'PLAINTEXT',
      },
    })
    latestVersionId = latest.id
    await prisma.document.update({ where: { id: document.id }, data: { currentVersionId: latest.id } })

    const otherSession = await prisma.session.create({
      data: { campaignId, title: 'Other Transcript Session', sessionNumber: 2 },
    })
    const otherDocument = await prisma.document.create({
      data: { campaignId, sessionId: otherSession.id, type: 'TRANSCRIPT', title: 'Other Transcript' },
    })
    const foreignVersion = await prisma.documentVersion.create({
      data: { documentId: otherDocument.id, versionNumber: 1, content: 'foreign', format: 'PLAINTEXT' },
    })
    foreignVersionId = foreignVersion.id

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.33' },
      body: JSON.stringify({ email, password }),
    })
    expect(login.status).toBe(200)
    const cookie = login.headers.get('set-cookie') || ''
    const createKey = async (permissions: string[]) => {
      const response = await fetch(`${baseUrl}/api/account/api-keys`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Transcript test key', campaignIds: [campaignId], permissions }),
      })
      expect(response.status).toBe(200)
      return (await response.json()).data.secret as string
    }
    bearer = await createKey(['transcripts.read'])
    deniedBearer = await createKey(['campaign.read'])
  }, 120_000)

  afterAll(async () => {
    if (campaignId) await prisma.campaign.delete({ where: { id: campaignId } })
    await prisma.$disconnect()
  })

  it('defaults to the latest version and supports bounded line reads', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/transcript?startLine=2&limit=2`, {
      headers: { authorization: `Bearer ${bearer}` },
    })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data).toMatchObject({
      mode: 'read', documentId: expect.any(String), versionId: latestVersionId, totalLines: 4, startLine: 2, endLine: 3,
      lines: [{ lineNumber: 2, text: '' }, { lineNumber: 3, text: 'The dragon appears' }],
    })
  })

  it('searches with literal case-insensitive matching and rejects foreign versions', async () => {
    const search = await fetch(`${baseUrl}/api/sessions/${sessionId}/transcript?q=DRAGON&contextLines=0`, {
      headers: { authorization: `Bearer ${bearer}` },
    })
    expect(search.status).toBe(200)
    expect((await search.json()).data).toMatchObject({ totalMatches: 2, totalResults: 2 })

    const foreign = await fetch(`${baseUrl}/api/sessions/${sessionId}/transcript?versionId=${foreignVersionId}`, {
      headers: { authorization: `Bearer ${bearer}` },
    })
    expect(foreign.status).toBe(404)
  })

  it('requires the transcript resource permission on bearer keys', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/transcript`, {
      headers: { authorization: `Bearer ${deniedBearer}` },
    })
    expect(response.status).toBe(403)
  })
})
