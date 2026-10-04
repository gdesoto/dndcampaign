// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestDatabase } from '../scripts/db-test-client'
import * as tables from '../../server/db/schema'
import { eq } from 'drizzle-orm'

const db = createApiTestDatabase()
const hash = new Hash(new Scrypt({}))
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
    const user = db.insert(tables.user).values({ email, passwordHash: await hash.make(password), name: 'Transcript API User' }).onConflictDoUpdate({ target: tables.user.email, set: { passwordHash: await hash.make(password), name: 'Transcript API User' } }).returning().get()!
    const campaign = db.insert(tables.campaign).values({ ownerId: user.id, name: 'Transcript Reader Campaign', system: 'D&D 5e' }).returning().get()!
    campaignId = campaign.id
    const session = db.insert(tables.session).values({ campaignId, title: 'Transcript Reader Session', sessionNumber: 1 }).returning().get()!
    sessionId = session.id
    const document = db.insert(tables.document).values({ campaignId, sessionId, type: 'TRANSCRIPT', title: 'Transcript' }).returning().get()!
    db.insert(tables.documentVersion).values({ documentId: document.id, versionNumber: 1, content: 'old line', format: 'PLAINTEXT' }).returning().get()!
    const latest = db.insert(tables.documentVersion).values({
      documentId: document.id,
      versionNumber: 2,
      content: 'First line\n\nThe dragon appears\nThe dragon retreats',
      format: 'PLAINTEXT',
    }).returning().get()!
    latestVersionId = latest.id
    db.update(tables.document).set({ currentVersionId: latest.id }).where(eq(tables.document.id, document.id)).returning().get()!

    const otherSession = db.insert(tables.session).values({ campaignId, title: 'Other Transcript Session', sessionNumber: 2 }).returning().get()!
    const otherDocument = db.insert(tables.document).values({ campaignId, sessionId: otherSession.id, type: 'TRANSCRIPT', title: 'Other Transcript' }).returning().get()!
    const foreignVersion = db.insert(tables.documentVersion).values({ documentId: otherDocument.id, versionNumber: 1, content: 'foreign', format: 'PLAINTEXT' }).returning().get()!
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
    if (campaignId) db.delete(tables.campaign).where(eq(tables.campaign.id, campaignId)).returning().get()!
    db.$client.close()
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
