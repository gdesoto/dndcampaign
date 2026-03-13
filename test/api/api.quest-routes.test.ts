// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const prisma = createApiTestPrismaClient()
const hash = new Hash(new Scrypt())
const baseUrl = getApiTestBaseUrl()

const ownerUser = {
  email: 'quest-owner@example.com',
  password: 'quest-owner-pass',
  name: 'Quest Owner',
}

const authHeaders = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.28',
}

const sleep = (ms: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))

const loginAndGetCookie = async (email: string, password: string) => {
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

describe('quest API routes', () => {
  let ownerId = ''
  let ownerCookie = ''
  let campaignId = ''

  beforeAll(async () => {
    const ownerPasswordHash = await hash.make(ownerUser.password)

    const owner = await prisma.user.upsert({
      where: { email: ownerUser.email },
      update: {
        passwordHash: ownerPasswordHash,
        name: ownerUser.name,
      },
      create: {
        email: ownerUser.email,
        passwordHash: ownerPasswordHash,
        name: ownerUser.name,
      },
    })
    ownerId = owner.id

    await prisma.campaign.deleteMany({ where: { ownerId } })

    const campaign = await prisma.campaign.create({
      data: {
        ownerId,
        name: 'Quest Route Test Campaign',
        system: 'D&D 5e',
      },
    })
    campaignId = campaign.id

    ownerCookie = await loginAndGetCookie(ownerUser.email, ownerUser.password)

    const applyResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/config/template`, {
      method: 'POST',
      headers: {
        cookie: ownerCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ templateId: 'earth' }),
    })

    expect(applyResponse.status).toBe(200)
  }, 120_000)

  beforeEach(async () => {
    await prisma.quest.deleteMany({ where: { campaignId } })
    await prisma.glossaryEntry.deleteMany({ where: { campaignId } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates and updates a quest with category, track, source, reward, and expiration date', async () => {
    const npc = await prisma.glossaryEntry.create({
      data: {
        campaignId,
        type: 'NPC',
        name: 'Guildmaster Tovin',
        description: 'Guildmaster issuing work to the party.',
      },
    })

    const sourceCharacter = await prisma.playerCharacter.create({
      data: {
        ownerId,
        name: 'Sir Rowan',
        sheetJson: {},
        summaryJson: {},
      },
    })

    await prisma.campaignCharacter.create({
      data: {
        campaignId,
        characterId: sourceCharacter.id,
      },
    })

    const createResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/quests`, {
      method: 'POST',
      headers: {
        cookie: ownerCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Recover the ancient seal',
        description: 'Travel to the ruined watchtower.',
        type: 'CAMPAIGN',
        track: 'MAIN',
        sourceType: 'NPC',
        sourceNpcId: npc.id,
        reward: '500 gp and guild favor',
        status: 'ACTIVE',
        progressNotes: 'The party has the map fragment.',
        expirationDate: {
          year: 2026,
          month: 3,
          day: 12,
        },
      }),
    })

    expect(createResponse.status).toBe(200)
    const createPayload = await createResponse.json()
    expect(createPayload.data.type).toBe('CAMPAIGN')
    expect(createPayload.data.track).toBe('MAIN')
    expect(createPayload.data.sourceType).toBe('NPC')
    expect(createPayload.data.sourceNpcName).toBe('Guildmaster Tovin')
    expect(createPayload.data.reward).toBe('500 gp and guild favor')
    expect(createPayload.data.expirationDate).toEqual({
      year: 2026,
      month: 3,
      day: 12,
    })

    const updateResponse = await fetch(`${baseUrl}/api/quests/${createPayload.data.id}`, {
      method: 'PATCH',
      headers: {
        cookie: ownerCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'CHARACTER',
        track: 'SIDE',
        sourceType: 'CAMPAIGN_CHARACTER',
        sourceText: null,
        sourceNpcId: null,
        sourceCharacterId: sourceCharacter.id,
        reward: 'A personal favor from the crown',
        expirationDate: null,
      }),
    })

    expect(updateResponse.status).toBe(200)
    const updatePayload = await updateResponse.json()
    expect(updatePayload.data.type).toBe('CHARACTER')
    expect(updatePayload.data.track).toBe('SIDE')
    expect(updatePayload.data.sourceType).toBe('CAMPAIGN_CHARACTER')
    expect(updatePayload.data.sourceNpcId).toBeNull()
    expect(updatePayload.data.sourceCharacterId).toBe(sourceCharacter.id)
    expect(updatePayload.data.sourceCharacterName).toBe('Sir Rowan')
    expect(updatePayload.data.expirationDate).toBeNull()
  })
})
