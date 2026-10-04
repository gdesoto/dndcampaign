// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestDatabase } from '../scripts/db-test-client'
import * as tables from '../../server/db/schema'
import { and, count, eq, inArray } from 'drizzle-orm'

const db = createApiTestDatabase()
const hash = new Hash(new Scrypt({}))
const baseUrl = getApiTestBaseUrl()
const password = 'glossary-character-sync-pass'
const authHeaders = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.82',
}

const sleep = (ms: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))

const loginAndGetCookie = async (email: string) => {
  for (let attempt = 0;attempt < 20;attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email, password }),
    })
    if (response.status === 429) {
      await sleep(250)
      continue
    }
    expect(response.status).toBe(200)
    return response.headers.get('set-cookie') || ''
  }
  throw new Error(`Rate-limited while logging in ${email}`)
}

describe('glossary character synchronization', () => {
  let ownerId = ''
  let outsiderId = ''
  let ownerCookie = ''
  let campaignId = ''

  beforeAll(async () => {
    const passwordHash = await hash.make(password)
    const owner = db.insert(tables.user).values({ email: 'glossary-sync-owner@example.com', name: 'Glossary Sync Owner', passwordHash }).onConflictDoUpdate({ target: tables.user.email, set: { passwordHash } }).returning().get()!
    const outsider = db.insert(tables.user).values({ email: 'glossary-sync-outsider@example.com', name: 'Glossary Sync Outsider', passwordHash }).onConflictDoUpdate({ target: tables.user.email, set: { passwordHash } }).returning().get()!
    ownerId = owner.id
    outsiderId = outsider.id

    db.delete(tables.campaign).where(inArray(tables.campaign.ownerId, [ownerId, outsiderId])).run()
    db.delete(tables.playerCharacter).where(inArray(tables.playerCharacter.ownerId, [ownerId, outsiderId])).run()

    const campaign = db.insert(tables.campaign).values({ ownerId, name: 'Glossary Character Sync Campaign', system: 'D&D 5e' }).returning().get()!
    campaignId = campaign.id
    ownerCookie = await loginAndGetCookie('glossary-sync-owner@example.com')
  }, 120_000)

  afterAll(async () => {
    db.$client.close()
  })

  it('links PC glossary entries to an owner character, reuses the owner match and campaign link, and leaves non-PCs and other owners alone', async () => {
    const ownerCharacter = db.insert(tables.playerCharacter).values({
      ownerId,
      name: 'Mira Vale',
      sheetJson: { basics: { name: 'Mira Vale', level: 4 }, notes: { other: 'Existing notes.' } },
      summaryJson: { name: 'Mira Vale', level: 4 },
    }).returning().get()!
    const outsiderCharacter = db.insert(tables.playerCharacter).values({
      ownerId: outsiderId,
      name: 'Mira Vale',
      sheetJson: { basics: { name: 'Mira Vale' } },
      summaryJson: { name: 'Mira Vale' },
    }).returning().get()!

    const pcResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/glossary`, {
      method: 'POST',
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'PC', name: 'Mira Vale', description: 'A quick-witted ranger.' }),
    })
    expect(pcResponse.status).toBe(200)
    const pcPayload = await pcResponse.json()

    const repeatedPcResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/glossary`, {
      method: 'POST',
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'PC', name: 'Mira Vale', description: 'A seasoned ranger.' }),
    })
    expect(repeatedPcResponse.status).toBe(200)
    const repeatedPcPayload = await repeatedPcResponse.json()

    const nonPcResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/glossary`, {
      method: 'POST',
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'NPC', name: 'Captain Orin', description: 'Harbor watch captain.' }),
    })
    expect(nonPcResponse.status).toBe(200)
    const nonPcPayload = await nonPcResponse.json()

    const link = (db.query.campaignCharacter.findFirst({ where: and(eq(tables.campaignCharacter.campaignId, campaignId), eq(tables.campaignCharacter.characterId, ownerCharacter.id)) }).sync() ?? null)
    expect(link?.glossaryEntryId).toBe(repeatedPcPayload.data.id)
    expect(repeatedPcPayload.data.id).not.toBe(pcPayload.data.id)
    expect(db.select({ count: count() }).from(tables.playerCharacter).where(and(eq(tables.playerCharacter.ownerId, ownerId), eq(tables.playerCharacter.name, 'Mira Vale'))).get()!.count).toBe(1)
    expect((db.query.playerCharacter.findFirst({ where: eq(tables.playerCharacter.id, ownerCharacter.id) }).sync() ?? null)).toMatchObject({
      sheetJson: { basics: { name: 'Mira Vale', level: 4 }, notes: { other: 'Existing notes.' } },
      summaryJson: { name: 'Mira Vale', level: 4 },
    })
    expect(db.select({ count: count() }).from(tables.campaignCharacter).where(and(eq(tables.campaignCharacter.campaignId, campaignId), eq(tables.campaignCharacter.glossaryEntryId, nonPcPayload.data.id))).get()!.count).toBe(0)
    expect(db.select({ count: count() }).from(tables.campaignCharacter).where(eq(tables.campaignCharacter.characterId, outsiderCharacter.id)).get()!.count).toBe(0)
  })

  it('migrates only PC glossary entries, preserves the result shape, and can delete migrated glossary entries', async () => {
    const migrationCampaign = db.insert(tables.campaign).values({ ownerId, name: 'Glossary Character Migration Campaign', system: 'D&D 5e' }).returning().get()!
    const pcEntry = db.insert(tables.glossaryEntry).values({ campaignId: migrationCampaign.id, type: 'PC', name: 'Doran Flint', description: 'A steadfast cleric.' }).returning().get()!
    const npcEntry = db.insert(tables.glossaryEntry).values({ campaignId: migrationCampaign.id, type: 'NPC', name: 'Elder Sera', description: 'Village historian.' }).returning().get()!

    const response = await fetch(`${baseUrl}/api/dev/characters/migrate`, {
      method: 'POST',
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ campaignId: migrationCampaign.id, deleteGlossary: true }),
    })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data).toMatchObject({ migrated: 1, results: [{ glossaryId: pcEntry.id }] })

    const characterId = payload.data.results[0].characterId as string
    expect((db.query.playerCharacter.findFirst({ where: eq(tables.playerCharacter.id, characterId) }).sync() ?? null)).toMatchObject({
      sourceProvider: 'MANUAL',
      sheetJson: { basics: { name: 'Doran Flint' }, notes: { other: 'A steadfast cleric.' } },
      summaryJson: { name: 'Doran Flint' },
    })
    expect((db.query.glossaryEntry.findFirst({ where: eq(tables.glossaryEntry.id, pcEntry.id) }).sync() ?? null)).toBeNull()
    expect((db.query.glossaryEntry.findFirst({ where: eq(tables.glossaryEntry.id, npcEntry.id) }).sync() ?? null)).not.toBeNull()
    expect(
      (db.query.campaignCharacter.findFirst({ where: and(eq(tables.campaignCharacter.campaignId, migrationCampaign.id), eq(tables.campaignCharacter.characterId, characterId)) }).sync() ?? null)
    ).toMatchObject({ glossaryEntryId: null })
  })
})
