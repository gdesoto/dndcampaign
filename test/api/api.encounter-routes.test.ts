// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { getApiTestBaseUrl, getApiTestDatabaseUrl } from '../scripts/api-test-context.mjs'

const prisma = new PrismaClient({ datasourceUrl: getApiTestDatabaseUrl() })
const hash = new Hash(new Scrypt())
const baseUrl = getApiTestBaseUrl()
const password = 'encounter-api-pass'

const users = {
  owner: { email: 'enc-owner@example.com', name: 'Encounter Owner' },
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

    const campaign = await prisma.campaign.create({
      data: {
        ownerId,
        name: 'Encounter API Campaign',
        members: {
          create: [
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
    cookies.viewer = await loginAndGetCookie(users.viewer.email)
    cookies.outsider = await loginAndGetCookie(users.outsider.email)

    expect(await meEmail(cookies.owner)).toBe(users.owner.email)
    expect(await meEmail(cookies.viewer)).toBe(users.viewer.email)
    expect(await meEmail(cookies.outsider)).toBe(users.outsider.email)
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
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

    const outsiderDamage = await fetch(`${baseUrl}/api/encounters/${encounterId}/combatants/${combatantId}/apply-damage`, {
      method: 'POST',
      headers: {
        cookie: cookies.outsider,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ amount: 3 }),
    })
    expect(outsiderDamage.status).toBe(404)

    const ownerDamage = await fetch(`${baseUrl}/api/encounters/${encounterId}/combatants/${combatantId}/apply-damage`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ amount: 5 }),
    })
    expect(ownerDamage.status).toBe(200)

    const start = await fetch(`${baseUrl}/api/encounters/${encounterId}/start`, {
      method: 'POST',
      headers: { cookie: cookies.owner },
    })
    expect(start.status).toBe(200)

    const reset = await fetch(`${baseUrl}/api/encounters/${encounterId}/reset`, {
      method: 'POST',
      headers: { cookie: cookies.owner },
    })
    expect(reset.status).toBe(200)

    const firstRoll = await fetch(`${baseUrl}/api/encounters/${encounterId}/initiative/roll`, {
      method: 'POST',
      headers: { cookie: cookies.owner },
    })
    expect(firstRoll.status).toBe(200)

    const secondRoll = await fetch(`${baseUrl}/api/encounters/${encounterId}/initiative/roll`, {
      method: 'POST',
      headers: { cookie: cookies.owner },
    })
    expect(secondRoll.status).toBe(200)

    const combatantsAfterRoll = await fetch(`${baseUrl}/api/encounters/${encounterId}/combatants`, {
      headers: { cookie: cookies.owner },
    })
    expect(combatantsAfterRoll.status).toBe(200)
    const combatantsPayload = await combatantsAfterRoll.json()
    const sortOrders = combatantsPayload.data.map((entry: { sortOrder: number }) => entry.sortOrder)
    expect(new Set(sortOrders).size).toBe(sortOrders.length)

    const advance = await fetch(`${baseUrl}/api/encounters/${encounterId}/turn/advance`, {
      method: 'POST',
      headers: { cookie: cookies.owner },
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
