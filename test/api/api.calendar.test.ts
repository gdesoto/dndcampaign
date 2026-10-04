// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestDatabase } from '../scripts/db-test-client'
import * as tables from '../../server/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const db = createApiTestDatabase()
const hash = new Hash(new Scrypt({}))
const baseUrl = getApiTestBaseUrl()
const password = 'calendar-api-pass'
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
  throw new Error(`Rate-limited while logging in test user ${email}`)
}

describe('campaign calendar API', () => {
  beforeAll(async () => {
    const passwordHash = await hash.make(password)
    const emails = Object.values(users).map((user) => user.email)

    db.delete(tables.campaignMember).where(inArray(tables.campaignMember.userId, db.select({ id: tables.user.id }).from(tables.user).where(inArray(tables.user.email, emails)))).run()
    db.delete(tables.user).where(inArray(tables.user.email, emails)).run()

    const createdUsers = await Promise.all(
      Object.values(users).map((user) =>
        db.insert(tables.user).values({
          email: user.email,
          name: user.name,
          passwordHash,
        }).returning().get()!,
      ),
    )

    const ownerId = createdUsers.find((user) => user.email === users.owner.email)?.id as string
    const collaboratorId = createdUsers.find((user) => user.email === users.collaborator.email)?.id as string
    const viewerId = createdUsers.find((user) => user.email === users.viewer.email)?.id as string

    const campaign = db.insert(tables.campaign).values({ ownerId: ownerId, name: 'Calendar API Campaign' }).returning().get()!
    db.insert(tables.campaignMember).values(([
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
    ] as const).map(member => ({ ...member, campaignId: campaign.id }))).run()
    campaignId = campaign.id

    for (const [key, value] of Object.entries(users)) {
      cookies[key] = await loginAndGetCookie(value.email)
    }
  }, 120_000)

  afterAll(async () => {
    db.$client.close()
  })

  it('applies calendar template and allows read access', async () => {
    const applyResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/config/template`, {
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

    const viewResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/config`, {
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
          seed: 'calendar-api-seed',
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
    const collaboratorUpdate = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/config/current-date`, {
      method: 'PUT',
      headers: {
        cookie: cookies.collaborator,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ year: 2026, month: 2, day: 10 }),
    })
    expect(collaboratorUpdate.status).toBe(200)

    const viewerUpdate = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/config/current-date`, {
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

    const rangeUpsert = await fetch(`${baseUrl}/api/sessions/${sessionId}/calendar/range`, {
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

    const viewerRangeUpsert = await fetch(`${baseUrl}/api/sessions/${sessionId}/calendar/range`, {
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

    const createEvent = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/events`, {
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

    const viewerCreateEvent = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/events`, {
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

    const patchEvent = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.collaborator,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: 'Festival Day Updated' }),
    })
    expect(patchEvent.status).toBe(200)

    const calendarView = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/view?year=2026&month=2`, {
      headers: { cookie: cookies.viewer },
    })
    expect(calendarView.status).toBe(200)
    const calendarViewPayload = await calendarView.json()
    expect(calendarViewPayload.data.events.some((event: { id: string }) => event.id === eventId)).toBe(true)
    expect(
      calendarViewPayload.data.sessionRanges.some((range: { sessionId: string }) => range.sessionId === sessionId),
    ).toBe(true)

    const deleteEvent = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/events/${eventId}`, {
      method: 'DELETE',
      headers: { cookie: cookies.collaborator },
    })
    expect(deleteEvent.status).toBe(200)

    const deleteRange = await fetch(`${baseUrl}/api/sessions/${sessionId}/calendar/range`, {
      method: 'DELETE',
      headers: { cookie: cookies.collaborator },
    })
    expect(deleteRange.status).toBe(200)
  })

  it('returns only ordered session ranges intersecting the selected month, including its boundaries', async () => {
    const sessions = []
    for (const data of [
      { title: 'Before February', sessionNumber: 1, playedAt: new Date('2026-01-30T12:00:00.000Z') },
      { title: 'Starts Before February', sessionNumber: 2, playedAt: new Date('2026-02-01T12:00:00.000Z') },
      { title: 'Within February', sessionNumber: 3, playedAt: new Date('2026-02-15T12:00:00.000Z') },
      { title: 'Ends After February', sessionNumber: 4, playedAt: new Date('2026-02-28T12:00:00.000Z') },
      { title: 'After February', sessionNumber: 5, playedAt: new Date('2026-03-02T12:00:00.000Z') },
    ]) {
      sessions.push(db.insert(tables.session).values({ campaignId, ...data }).returning().get()!)
    }
    const [before, first, middle, last, after] = sessions
    db.insert(tables.sessionCalendarRange).values([
      {
        campaignId,
        sessionId: before.id,
        startYear: 2026,
        startMonth: 1,
        startDay: 30,
        endYear: 2026,
        endMonth: 1,
        endDay: 31,
      },
      {
        campaignId,
        sessionId: first.id,
        startYear: 2026,
        startMonth: 1,
        startDay: 31,
        endYear: 2026,
        endMonth: 2,
        endDay: 1,
      },
      {
        campaignId,
        sessionId: middle.id,
        startYear: 2026,
        startMonth: 2,
        startDay: 15,
        endYear: 2026,
        endMonth: 2,
        endDay: 15,
      },
      {
        campaignId,
        sessionId: last.id,
        startYear: 2026,
        startMonth: 2,
        startDay: 28,
        endYear: 2026,
        endMonth: 3,
        endDay: 1,
      },
      {
        campaignId,
        sessionId: after.id,
        startYear: 2026,
        startMonth: 3,
        startDay: 1,
        endYear: 2026,
        endMonth: 3,
        endDay: 2,
      },
    ]).run()

    const response = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/view?year=2026&month=2`, {
      headers: { cookie: cookies.viewer },
    })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data.sessionRanges.map((range: { sessionId: string }) => range.sessionId)).toEqual([
      first.id,
      middle.id,
      last.id,
    ])
    expect(payload.data.sessionRanges[0].session).toMatchObject({
      id: first.id,
      title: 'Starts Before February',
      sessionNumber: 2,
      playedAt: '2026-02-01T12:00:00.000Z',
    })

    const defaultMonthResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/view`, {
      headers: { cookie: cookies.viewer },
    })
    expect(defaultMonthResponse.status).toBe(200)
    const defaultMonthPayload = await defaultMonthResponse.json()
    expect(defaultMonthPayload.data.selectedMonth).toMatchObject({ year: 2026, month: 2, length: 28 })

    const invalidMonthResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/view?month=13`, {
      headers: { cookie: cookies.viewer },
    })
    expect(invalidMonthResponse.status).toBe(400)
    const invalidMonthPayload = await invalidMonthResponse.json()
    expect(invalidMonthPayload.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Month must be between 1 and 12',
    })
  })

  it('keeps empty views for campaigns without a calendar and disabled calendars', async () => {
    const owner = (db.query.user.findFirst({ where: eq(tables.user.email, users.owner.email), columns: { id: true } }).sync()!)
    const campaignWithoutConfig = db.insert(tables.campaign).values({ ownerId: owner.id, name: 'Calendar API No Config Campaign' }).returning().get()!
    db.insert(tables.campaignMember).values(([{
      userId: owner.id,
      role: 'OWNER',
      invitedByUserId: owner.id,
    }] as const).map(member => ({ ...member, campaignId: campaignWithoutConfig.id }))).run()

    const missingConfigResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignWithoutConfig.id}/calendar/view?year=2030&month=1`,
      { headers: { cookie: cookies.owner } },
    )
    expect(missingConfigResponse.status).toBe(200)
    expect((await missingConfigResponse.json()).data).toEqual({
      config: null,
      currentDate: null,
      selectedMonth: null,
      events: [],
      sessionRanges: [],
    })

    db.update(tables.campaignCalendarConfig).set({ isEnabled: false }).where(eq(tables.campaignCalendarConfig.campaignId, campaignId)).returning().get()!
    const disabledResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/calendar/view`, {
      headers: { cookie: cookies.viewer },
    })
    expect(disabledResponse.status).toBe(200)
    const disabledPayload = await disabledResponse.json()
    expect(disabledPayload.data).toMatchObject({
      config: { isEnabled: false },
      currentDate: { year: 2026, month: 2, day: 10 },
      selectedMonth: null,
      events: [],
      sessionRanges: [],
    })
  })
})
