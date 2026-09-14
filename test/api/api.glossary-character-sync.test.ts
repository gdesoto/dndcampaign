// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'

const prisma = createApiTestPrismaClient()
const hash = new Hash(new Scrypt())
const baseUrl = getApiTestBaseUrl()
const password = 'glossary-character-sync-pass'
const authHeaders = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.82',
}

const sleep = (ms: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))

const loginAndGetCookie = async (email: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
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
    const owner = await prisma.user.upsert({
      where: { email: 'glossary-sync-owner@example.com' },
      update: { passwordHash },
      create: { email: 'glossary-sync-owner@example.com', name: 'Glossary Sync Owner', passwordHash },
    })
    const outsider = await prisma.user.upsert({
      where: { email: 'glossary-sync-outsider@example.com' },
      update: { passwordHash },
      create: { email: 'glossary-sync-outsider@example.com', name: 'Glossary Sync Outsider', passwordHash },
    })
    ownerId = owner.id
    outsiderId = outsider.id

    await prisma.campaign.deleteMany({ where: { ownerId: { in: [ownerId, outsiderId] } } })
    await prisma.playerCharacter.deleteMany({ where: { ownerId: { in: [ownerId, outsiderId] } } })

    const campaign = await prisma.campaign.create({
      data: { ownerId, name: 'Glossary Character Sync Campaign', system: 'D&D 5e' },
    })
    campaignId = campaign.id
    ownerCookie = await loginAndGetCookie('glossary-sync-owner@example.com')
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('links PC glossary entries to an owner character, reuses the owner match and campaign link, and leaves non-PCs and other owners alone', async () => {
    const ownerCharacter = await prisma.playerCharacter.create({
      data: {
        ownerId,
        name: 'Mira Vale',
        sheetJson: { basics: { name: 'Mira Vale', level: 4 }, notes: { other: 'Existing notes.' } },
        summaryJson: { name: 'Mira Vale', level: 4 },
      },
    })
    const outsiderCharacter = await prisma.playerCharacter.create({
      data: {
        ownerId: outsiderId,
        name: 'Mira Vale',
        sheetJson: { basics: { name: 'Mira Vale' } },
        summaryJson: { name: 'Mira Vale' },
      },
    })

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

    const link = await prisma.campaignCharacter.findUnique({
      where: { campaignId_characterId: { campaignId, characterId: ownerCharacter.id } },
    })
    expect(link?.glossaryEntryId).toBe(repeatedPcPayload.data.id)
    expect(repeatedPcPayload.data.id).not.toBe(pcPayload.data.id)
    expect(await prisma.playerCharacter.count({ where: { ownerId, name: 'Mira Vale' } })).toBe(1)
    expect(await prisma.playerCharacter.findUnique({ where: { id: ownerCharacter.id } })).toMatchObject({
      sheetJson: { basics: { name: 'Mira Vale', level: 4 }, notes: { other: 'Existing notes.' } },
      summaryJson: { name: 'Mira Vale', level: 4 },
    })
    expect(await prisma.campaignCharacter.count({ where: { campaignId, glossaryEntryId: nonPcPayload.data.id } })).toBe(0)
    expect(await prisma.campaignCharacter.count({ where: { characterId: outsiderCharacter.id } })).toBe(0)
  })

  it('migrates only PC glossary entries, preserves the result shape, and can delete migrated glossary entries', async () => {
    const migrationCampaign = await prisma.campaign.create({
      data: { ownerId, name: 'Glossary Character Migration Campaign', system: 'D&D 5e' },
    })
    const pcEntry = await prisma.glossaryEntry.create({
      data: { campaignId: migrationCampaign.id, type: 'PC', name: 'Doran Flint', description: 'A steadfast cleric.' },
    })
    const npcEntry = await prisma.glossaryEntry.create({
      data: { campaignId: migrationCampaign.id, type: 'NPC', name: 'Elder Sera', description: 'Village historian.' },
    })

    const response = await fetch(`${baseUrl}/api/dev/characters/migrate`, {
      method: 'POST',
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ campaignId: migrationCampaign.id, deleteGlossary: true }),
    })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data).toMatchObject({ migrated: 1, results: [{ glossaryId: pcEntry.id }] })

    const characterId = payload.data.results[0].characterId as string
    expect(await prisma.playerCharacter.findUnique({ where: { id: characterId } })).toMatchObject({
      sourceProvider: 'MANUAL',
      sheetJson: { basics: { name: 'Doran Flint' }, notes: { other: 'A steadfast cleric.' } },
      summaryJson: { name: 'Doran Flint' },
    })
    expect(await prisma.glossaryEntry.findUnique({ where: { id: pcEntry.id } })).toBeNull()
    expect(await prisma.glossaryEntry.findUnique({ where: { id: npcEntry.id } })).not.toBeNull()
    expect(
      await prisma.campaignCharacter.findUnique({
        where: { campaignId_characterId: { campaignId: migrationCampaign.id, characterId } },
      })
    ).toMatchObject({ glossaryEntryId: null })
  })
})
