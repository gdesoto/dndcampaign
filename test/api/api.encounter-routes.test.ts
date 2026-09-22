// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const prisma = createApiTestPrismaClient()
const hash = new Hash(new Scrypt())
const baseUrl = getApiTestBaseUrl()
const password = 'encounter-api-pass'

const users = {
  owner: { email: 'enc-owner@example.com', name: 'Encounter Owner' },
  collaborator: { email: 'enc-collaborator@example.com', name: 'Encounter Collaborator' },
  viewer: { email: 'enc-viewer@example.com', name: 'Encounter Viewer' },
  outsider: { email: 'enc-outsider@example.com', name: 'Encounter Outsider' },
}

const cookies: Record<string, string> = {}
let campaignId = ''
let encounterId = ''
let combatantId = ''

const loginAndGetCookie = async (email: string) => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '198.51.100.12',
    },
    body: JSON.stringify({ email, password }),
  })
  expect(response.status).toBe(200)
  const rawCookie = response.headers.get('set-cookie') || ''
  const match = rawCookie.match(/nuxt-session=[^;]+/)
  return match?.[0] || ''
}

const meEmail = async (cookie: string) => {
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie },
  })
  expect(response.status).toBe(200)
  const payload = await response.json()
  return payload.data.user.email as string
}

describe('encounter API routes', () => {
  beforeAll(async () => {
    const passwordHash = await hash.make(password)
    const emails = Object.values(users).map((user) => user.email)

    await prisma.campaignMember.deleteMany({ where: { user: { email: { in: emails } } } })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })

    const createdUsers = await Promise.all(
      Object.values(users).map((user) =>
        prisma.user.create({
          data: {
            email: user.email,
            name: user.name,
            passwordHash,
          },
          select: { id: true, email: true },
        }),
      ),
    )

    const ownerId = createdUsers.find((user) => user.email === users.owner.email)?.id as string
    const viewerId = createdUsers.find((user) => user.email === users.viewer.email)?.id as string
    const collaboratorId = createdUsers.find((user) => user.email === users.collaborator.email)?.id as string

    const campaign = await prisma.campaign.create({
      data: {
        ownerId,
        name: 'Encounter API Campaign',
        members: {
          create: [
            {
              userId: collaboratorId,
              role: 'COLLABORATOR',
              invitedByUserId: ownerId,
            },
            {
              userId: ownerId,
              role: 'OWNER',
              invitedByUserId: ownerId,
            },
            {
              userId: viewerId,
              role: 'VIEWER',
              invitedByUserId: ownerId,
            },
          ],
        },
      },
      select: { id: true },
    })

    campaignId = campaign.id
    cookies.owner = await loginAndGetCookie(users.owner.email)
    cookies.collaborator = await loginAndGetCookie(users.collaborator.email)
    cookies.viewer = await loginAndGetCookie(users.viewer.email)
    cookies.outsider = await loginAndGetCookie(users.outsider.email)

    expect(await meEmail(cookies.owner)).toBe(users.owner.email)
    expect(await meEmail(cookies.viewer)).toBe(users.viewer.email)
    expect(await meEmail(cookies.outsider)).toBe(users.outsider.email)
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it.each([
    { role: 'owner', readStatus: 200, writeStatus: 200 },
    { role: 'collaborator', readStatus: 200, writeStatus: 200 },
    { role: 'viewer', readStatus: 200, writeStatus: 404 },
    { role: 'outsider', readStatus: 404, writeStatus: 404 },
  ])('preserves encounter access for $role', async ({ role, readStatus, writeStatus }) => {
    const created = await fetch(`${baseUrl}/api/campaigns/${campaignId}/encounters`, {
      method: 'POST',
      headers: { cookie: cookies.owner, 'content-type': 'application/json' },
      body: JSON.stringify({ name: `Access check: ${role}`, type: 'COMBAT' }),
    })
    expect(created.status).toBe(200)
    const { data: encounter } = await created.json()
    for (const suffix of ['', '/summary']) {
      const response = await fetch(`${baseUrl}/api/encounters/${encounter.id}${suffix}`, {
        headers: { cookie: cookies[role] },
      })
      expect(response.status).toBe(readStatus)
    }
    const response = await fetch(`${baseUrl}/api/encounters/${encounter.id}`, {
      method: 'PATCH',
      headers: { cookie: cookies[role], 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    })
    expect(response.status).toBe(writeStatus)
    const stored = await prisma.campaignEncounter.findUniqueOrThrow({ where: { id: encounter.id } })
    expect(stored.status).toBe(writeStatus === 200 ? 'ACTIVE' : 'PLANNED')
  })

  it('inherits source stats while preserving overrides and missing values', async () => {
    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } })
    const encounter = await prisma.campaignEncounter.create({ data: { campaignId, createdByUserId: campaign.ownerId, name: 'Stat defaults', type: 'COMBAT' } })
    const glossary = await prisma.glossaryEntry.create({ data: { campaignId, name: 'Linked NPC', type: 'NPC', description: 'An ally' } })
    const character = await prisma.playerCharacter.create({ data: {
      ownerId: campaign.ownerId, name: 'Stat source',
      sheetJson: { hitPoints: { max: 28, current: 0 }, defenses: { ac: 16, speed: 35 } },
      summaryJson: { hp: 20, ac: 10 },
    } })
    const link = await prisma.campaignCharacter.create({ data: { campaignId, characterId: character.id, glossaryEntryId: glossary.id } })
    const block = await prisma.encounterStatBlock.create({ data: {
      campaignId, createdByUserId: campaign.ownerId, name: 'Stat source', statBlockJson: { maxHp: 12, armorClass: 13, speed: 30 },
    } })
    const create = async (body: Record<string, unknown>) => {
      const response = await fetch(`${baseUrl}/api/encounters/${encounter.id}/combatants`, {
        method: 'POST', headers: { cookie: cookies.owner, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Participant', ...body }),
      })
      expect(response.status).toBe(200)
      return (await response.json()).data
    }
    for (const source of [
      { sourceType: 'CAMPAIGN_CHARACTER', sourceCampaignCharacterId: link.id },
      { sourceType: 'CAMPAIGN_CHARACTER', sourceCampaignCharacterId: character.id },
      { sourceType: 'PLAYER_CHARACTER', sourcePlayerCharacterId: character.id },
      { sourceType: 'GLOSSARY_ENTRY', sourceGlossaryEntryId: glossary.id },
    ]) {
      expect(await create(source)).toMatchObject({ maxHp: 28, currentHp: 0, armorClass: 16, speed: 35 })
    }
    expect(await create({ sourceStatBlockId: block.id })).toMatchObject({ maxHp: 12, currentHp: 12, armorClass: 13, speed: 30 })
    expect(await create({ sourceStatBlockId: block.id, maxHp: 5, currentHp: 0, armorClass: 0, speed: 0 }))
      .toMatchObject({ maxHp: 5, currentHp: 0, armorClass: 0, speed: 0 })
    expect(await create({ sourceStatBlockId: block.id, maxHp: 5 })).toMatchObject({ maxHp: 5, currentHp: 5 })
    expect(await create({})).toMatchObject({ maxHp: null, currentHp: null, armorClass: null, speed: null })
    await prisma.encounterStatBlock.update({ where: { id: block.id }, data: { statBlockJson: { maxHp: -1, armorClass: '13', speed: 2.5 } } })
    expect(await create({ sourceStatBlockId: block.id })).toMatchObject({ maxHp: null, currentHp: null, armorClass: null, speed: null })
    await prisma.playerCharacter.update({ where: { id: character.id }, data: { sheetJson: {} } })
    expect(await create({ sourceType: 'PLAYER_CHARACTER', sourcePlayerCharacterId: character.id }))
      .toMatchObject({ maxHp: null, currentHp: 20, armorClass: 10, speed: null })
  })

  it('returns not found for a missing encounter on reads and lifecycle writes', async () => {
    for (const method of ['GET', 'PATCH']) {
      const response = await fetch(`${baseUrl}/api/encounters/missing-encounter`, {
        method,
        headers: { cookie: cookies.owner, 'content-type': 'application/json' },
        ...(method === 'PATCH' ? { body: JSON.stringify({ action: 'start' }) } : {}),
      })
      expect(response.status).toBe(404)
      expect((await response.json()).error.code).toBe('NOT_FOUND')
    }
  })

  it('creates encounter, updates runtime, and blocks viewer writes', async () => {
    const createEncounter = await fetch(`${baseUrl}/api/campaigns/${campaignId}/encounters`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Bridge Ambush',
        type: 'COMBAT',
      }),
    })
    expect(createEncounter.status).toBe(200)
    const encounterPayload = await createEncounter.json()
    encounterId = encounterPayload.data.id

    const listEncounters = await fetch(`${baseUrl}/api/campaigns/${campaignId}/encounters`, {
      headers: { cookie: cookies.viewer },
    })
    expect(listEncounters.status).toBe(200)
    const listPayload = await listEncounters.json()
    expect(listPayload.data.some((entry: { id: string }) => entry.id === encounterId)).toBe(true)

    const createCombatant = await fetch(`${baseUrl}/api/encounters/${encounterId}/combatants`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Bandit',
        side: 'ENEMY',
        sourceType: 'CUSTOM',
        maxHp: 12,
      }),
    })
    expect(createCombatant.status).toBe(200)
    const combatantPayload = await createCombatant.json()
    combatantId = combatantPayload.data.id

    const invalidSourceCombatant = await fetch(`${baseUrl}/api/encounters/${encounterId}/combatants`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Invalid Source',
        side: 'ALLY',
        sourceType: 'CAMPAIGN_CHARACTER',
        sourceCampaignCharacterId: 'missing-character-id',
      }),
    })
    expect(invalidSourceCombatant.status).toBe(400)

    const outsiderDamage = await fetch(`${baseUrl}/api/encounters/${encounterId}/combatants/${combatantId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.outsider,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ operation: 'damage', amount: 3 }),
    })
    expect(outsiderDamage.status).toBe(404)

    const ownerDamage = await fetch(`${baseUrl}/api/encounters/${encounterId}/combatants/${combatantId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ operation: 'damage', amount: 5 }),
    })
    expect(ownerDamage.status).toBe(200)

    const start = await fetch(`${baseUrl}/api/encounters/${encounterId}`, {
      method: 'PATCH',
      headers: { cookie: cookies.owner, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    })
    expect(start.status).toBe(200)

    const reset = await fetch(`${baseUrl}/api/encounters/${encounterId}`, {
      method: 'PATCH',
      headers: { cookie: cookies.owner, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    })
    expect(reset.status).toBe(200)

    const firstRoll = await fetch(`${baseUrl}/api/encounters/${encounterId}/initiative`, {
      method: 'PATCH',
      headers: { cookie: cookies.owner, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'roll' }),
    })
    expect(firstRoll.status).toBe(200)

    const secondRoll = await fetch(`${baseUrl}/api/encounters/${encounterId}/initiative`, {
      method: 'PATCH',
      headers: { cookie: cookies.owner, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'roll' }),
    })
    expect(secondRoll.status).toBe(200)

    const combatantsAfterRoll = await fetch(`${baseUrl}/api/encounters/${encounterId}/combatants`, {
      headers: { cookie: cookies.owner },
    })
    expect(combatantsAfterRoll.status).toBe(200)
    const combatantsPayload = await combatantsAfterRoll.json()
    const sortOrders = combatantsPayload.data.map((entry: { sortOrder: number }) => entry.sortOrder)
    expect(new Set(sortOrders).size).toBe(sortOrders.length)

    const advance = await fetch(`${baseUrl}/api/encounters/${encounterId}/turn`, {
      method: 'PATCH',
      headers: { cookie: cookies.owner, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'advance' }),
    })
    expect(advance.status).toBe(200)

    const events = await fetch(`${baseUrl}/api/encounters/${encounterId}/events`, {
      headers: { cookie: cookies.viewer },
    })
    expect(events.status).toBe(200)
    const eventsPayload = await events.json()
    expect(eventsPayload.data.length).toBeGreaterThan(0)

    const summary = await fetch(`${baseUrl}/api/encounters/${encounterId}/summary`, {
      headers: { cookie: cookies.viewer },
    })
    expect(summary.status).toBe(200)
    const summaryPayload = await summary.json()
    expect(summaryPayload.data.totalDamage).toBeGreaterThanOrEqual(5)
  })

  it('validates session and calendar linking rules on create', async () => {
    const owner = await prisma.user.findUnique({
      where: { email: users.owner.email },
      select: { id: true },
    })
    expect(owner?.id).toBeTruthy()

    const foreignCampaign = await prisma.campaign.create({
      data: {
        ownerId: owner!.id,
        name: 'Encounter Foreign Campaign',
      },
      select: { id: true },
    })
    const foreignSession = await prisma.session.create({
      data: {
        campaignId: foreignCampaign.id,
        title: 'Foreign Session',
      },
      select: { id: true },
    })

    const invalidSessionLink = await fetch(`${baseUrl}/api/campaigns/${campaignId}/encounters`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Invalid Session Link',
        type: 'COMBAT',
        sessionId: foreignSession.id,
      }),
    })
    expect(invalidSessionLink.status).toBe(400)

    const calendarWhenDisabled = await fetch(`${baseUrl}/api/campaigns/${campaignId}/encounters`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Calendar Disabled Encounter',
        type: 'COMBAT',
        calendarYear: 1024,
        calendarMonth: 1,
        calendarDay: 2,
      }),
    })
    expect(calendarWhenDisabled.status).toBe(409)

    await prisma.campaignCalendarConfig.upsert({
      where: { campaignId },
      update: {
        isEnabled: true,
        monthsJson: [{ length: 30 }],
      },
      create: {
        campaignId,
        isEnabled: true,
        name: 'Campaign Calendar',
        startingYear: 1000,
        firstWeekdayIndex: 0,
        currentYear: 1000,
        currentMonth: 1,
        currentDay: 1,
        weekdaysJson: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        monthsJson: [{ length: 30 }],
        moonsJson: [],
      },
    })

    const invalidCalendarDate = await fetch(`${baseUrl}/api/campaigns/${campaignId}/encounters`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Invalid Calendar Date',
        type: 'COMBAT',
        calendarYear: 1024,
        calendarMonth: 1,
        calendarDay: 31,
      }),
    })
    expect(invalidCalendarDate.status).toBe(400)

    const validCalendarDate = await fetch(`${baseUrl}/api/campaigns/${campaignId}/encounters`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Valid Calendar Date',
        type: 'COMBAT',
        calendarYear: 1024,
        calendarMonth: 1,
        calendarDay: 30,
      }),
    })
    expect(validCalendarDate.status).toBe(200)

    const invalidTransition = await fetch(`${baseUrl}/api/encounters/${encounterId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: 'COMPLETED',
      }),
    })
    expect(invalidTransition.status).toBe(409)

    const outOfBoundsTurn = await fetch(`${baseUrl}/api/encounters/${encounterId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        currentTurnIndex: 99,
      }),
    })
    expect(outOfBoundsTurn.status).toBe(400)
  })
})







