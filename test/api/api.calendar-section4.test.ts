// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { getApiTestBaseUrl, getApiTestDatabaseUrl } from '../scripts/api-test-context.mjs'

const prisma = new PrismaClient({ datasourceUrl: getApiTestDatabaseUrl() })
const hash = new Hash(new Scrypt())
const baseUrl = getApiTestBaseUrl()
const password = 'calendar-section4-pass'
const authHeaders = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.14',
}

const users = {
  owner: { email: 'calendar4-owner@example.com', name: 'Calendar4 Owner' },
  collaborator: { email: 'calendar4-collab@example.com', name: 'Calendar4 Collaborator' },
  viewer: { email: 'calendar4-viewer@example.com', name: 'Calendar4 Viewer' },
}

const cookies: Record<string, string> = {}
let campaignId = ''
let sessionId = ''
let eventId = ''

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
  throw new Error(`Rate-limited while logging in test user ${email}`)
}

describe('calendar section 4 API routes', () => {
  beforeAll(async () => {
    const passwordHash = await hash.make(password)
    const emails = Object.values(users).map((user) => user.email)

    await prisma.campaignMember.deleteMany({
      where: {
        user: {
          email: { in: emails },
        },
      },
    })
    await prisma.user.deleteMany({
      where: {
        email: { in: emails },
      },
    })

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
    const collaboratorId = createdUsers.find((user) => user.email === users.collaborator.email)?.id as string
    const viewerId = createdUsers.find((user) => user.email === users.viewer.email)?.id as string

    const campaign = await prisma.campaign.create({
      data: {
        ownerId,
        name: 'Calendar Section 4 Campaign',
        members: {
          create: [
            {
              userId: ownerId,
              role: 'OWNER',
              invitedByUserId: ownerId,
            },
            {
              userId: collaboratorId,
              role: 'COLLABORATOR',
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

    for (const [key, value] of Object.entries(users)) {
      cookies[key] = await loginAndGetCookie(value.email)
    }
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('applies calendar template and allows read access', async () => {
    const applyResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar-config/template`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ templateId: 'earth' }),
    })
    expect(applyResponse.status).toBe(200)
    const applyPayload = await applyResponse.json()
    expect(applyPayload.data.isEnabled).toBe(true)
    expect(applyPayload.data.months.length).toBeGreaterThan(0)

    const viewResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar-config`, {
      headers: { cookie: cookies.viewer },
    })
    expect(viewResponse.status).toBe(200)
    const viewPayload = await viewResponse.json()
    expect(viewPayload.data.name).toBeDefined()
  })

  it('supports deterministic generated names when seed is supplied', async () => {
    const request = async () =>
      fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/generate-name`, {
        method: 'POST',
        headers: {
          cookie: cookies.collaborator,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'weekday',
          count: 4,
          seed: 'calendar-section4-seed',
        }),
      })

    const first = await request()
    const second = await request()
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)

    const firstPayload = await first.json()
    const secondPayload = await second.json()
    expect(secondPayload.data.names).toEqual(firstPayload.data.names)
  })

  it('allows collaborator current date update and denies viewer update', async () => {
    const collaboratorUpdate = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar-config/current-date`, {
      method: 'PUT',
      headers: {
        cookie: cookies.collaborator,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ year: 2026, month: 2, day: 10 }),
    })
    expect(collaboratorUpdate.status).toBe(200)

    const viewerUpdate = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar-config/current-date`, {
      method: 'PUT',
      headers: {
        cookie: cookies.viewer,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ year: 2026, month: 2, day: 11 }),
    })
    expect(viewerUpdate.status).toBe(403)
  })

  it('supports session range upsert/delete and event CRUD with permissions', async () => {
    const sessionCreate = await fetch(`${baseUrl}/api/campaigns/${campaignId}/sessions`, {
      method: 'POST',
      headers: {
        cookie: cookies.collaborator,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: 'Calendar Session' }),
    })
    expect(sessionCreate.status).toBe(200)
    const sessionPayload = await sessionCreate.json()
    sessionId = sessionPayload.data.id

    const rangeUpsert = await fetch(`${baseUrl}/api/sessions/${sessionId}/calendar-range`, {
      method: 'PUT',
      headers: {
        cookie: cookies.collaborator,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        startYear: 2026,
        startMonth: 2,
        startDay: 10,
      }),
    })
    expect(rangeUpsert.status).toBe(200)
    const rangePayload = await rangeUpsert.json()
    expect(rangePayload.data.endDay).toBe(10)

    const viewerRangeUpsert = await fetch(`${baseUrl}/api/sessions/${sessionId}/calendar-range`, {
      method: 'PUT',
      headers: {
        cookie: cookies.viewer,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        startYear: 2026,
        startMonth: 2,
        startDay: 11,
      }),
    })
    expect(viewerRangeUpsert.status).toBe(403)

    const createEvent = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar-events`, {
      method: 'POST',
      headers: {
        cookie: cookies.collaborator,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        year: 2026,
        month: 2,
        day: 10,
        title: 'Festival Day',
      }),
    })
    expect(createEvent.status).toBe(200)
    const eventPayload = await createEvent.json()
    eventId = eventPayload.data.id

    const viewerCreateEvent = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar-events`, {
      method: 'POST',
      headers: {
        cookie: cookies.viewer,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        year: 2026,
        month: 2,
        day: 10,
        title: 'Viewer should not create',
      }),
    })
    expect(viewerCreateEvent.status).toBe(403)

    const patchEvent = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar-events/${eventId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.collaborator,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: 'Festival Day Updated' }),
    })
    expect(patchEvent.status).toBe(200)

    const calendarView = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar-view?year=2026&month=2`, {
      headers: { cookie: cookies.viewer },
    })
    expect(calendarView.status).toBe(200)
    const calendarViewPayload = await calendarView.json()
    expect(calendarViewPayload.data.events.some((event: { id: string }) => event.id === eventId)).toBe(true)
    expect(
      calendarViewPayload.data.sessionRanges.some((range: { sessionId: string }) => range.sessionId === sessionId),
    ).toBe(true)

    const deleteEvent = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar-events/${eventId}`, {
      method: 'DELETE',
      headers: { cookie: cookies.collaborator },
    })
    expect(deleteEvent.status).toBe(200)

    const deleteRange = await fetch(`${baseUrl}/api/sessions/${sessionId}/calendar-range`, {
      method: 'DELETE',
      headers: { cookie: cookies.collaborator },
    })
    expect(deleteRange.status).toBe(200)
  })
})
