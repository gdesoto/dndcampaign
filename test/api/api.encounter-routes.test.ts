// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setTimeout as delay } from 'node:timers/promises'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestDatabase } from '../scripts/db-test-client'
import * as tables from '../../server/db/schema'
import { asc, count, eq, inArray } from 'drizzle-orm'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const db = createApiTestDatabase()
const hash = new Hash(new Scrypt({}))
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
    const viewerId = createdUsers.find((user) => user.email === users.viewer.email)?.id as string
    const collaboratorId = createdUsers.find((user) => user.email === users.collaborator.email)?.id as string

    const campaign = db.insert(tables.campaign).values({ ownerId: ownerId, name: 'Encounter API Campaign' }).returning().get()!
    db.insert(tables.campaignMember).values(([
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
    ] as const).map(member => ({ ...member, campaignId: campaign.id }))).run()

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
    db.$client.close()
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
    db.insert(tables.encounterCombatant).values({ encounterId: encounter.id, name: 'Ready', sortOrder: 0 }).returning().get()!
    const response = await fetch(`${baseUrl}/api/encounters/${encounter.id}`, {
      method: 'PATCH',
      headers: { cookie: cookies[role], 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    })
    expect(response.status).toBe(writeStatus)
    const stored = (db.query.campaignEncounter.findFirst({ where: eq(tables.campaignEncounter.id, encounter.id) }).sync()!)
    expect(stored.status).toBe(writeStatus === 200 ? 'ACTIVE' : 'PLANNED')
  })

  it('inherits source stats while preserving overrides and missing values', async () => {
    const campaign = (db.query.campaign.findFirst({ where: eq(tables.campaign.id, campaignId) }).sync()!)
    const encounter = db.insert(tables.campaignEncounter).values({ campaignId, createdByUserId: campaign.ownerId, name: 'Stat defaults', type: 'COMBAT' }).returning().get()!
    const glossary = db.insert(tables.glossaryEntry).values({ campaignId, name: 'Linked NPC', type: 'NPC', description: 'An ally' }).returning().get()!
    const character = db.insert(tables.playerCharacter).values({
      ownerId: campaign.ownerId, name: 'Stat source',
      sheetJson: { hitPoints: { max: 28, current: 0 }, defenses: { ac: 16, speed: 35 } },
      summaryJson: { hp: 20, ac: 10 },
    }).returning().get()!
    const link = db.insert(tables.campaignCharacter).values({ campaignId, characterId: character.id, glossaryEntryId: glossary.id }).returning().get()!
    const block = db.insert(tables.encounterStatBlock).values({
      campaignId, createdByUserId: campaign.ownerId, name: 'Stat source', statBlockJson: { maxHp: 12, armorClass: 13, speed: 30 },
    }).returning().get()!
    const create = async (body: Record<string, unknown>) => {
      const response = await fetch(`${baseUrl}/api/encounters/${encounter.id}/combatants`, {
        method: 'POST', headers: { cookie: cookies.owner, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Participant', ...body }),
      })
      const payload = await response.json()
      expect(response.status, JSON.stringify(payload.error)).toBe(200)
      return payload.data
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
    db.update(tables.encounterStatBlock).set({ statBlockJson: { maxHp: -1, armorClass: '13', speed: 2.5 } }).where(eq(tables.encounterStatBlock.id, block.id)).returning().get()!
    expect(await create({ sourceStatBlockId: block.id })).toMatchObject({ maxHp: null, currentHp: null, armorClass: null, speed: null })
    db.update(tables.playerCharacter).set({ sheetJson: {} }).where(eq(tables.playerCharacter.id, character.id)).returning().get()!
    expect(await create({ sourceType: 'PLAYER_CHARACTER', sourcePlayerCharacterId: character.id }))
      .toMatchObject({ maxHp: null, currentHp: 20, armorClass: 10, speed: null })
  })

  it('adds a participant batch during an external write without losing order or audit events', async () => {
    const campaign = (db.query.campaign.findFirst({ where: eq(tables.campaign.id, campaignId) }).sync()!)
    const encounter = db.insert(tables.campaignEncounter).values({
      campaignId, createdByUserId: campaign.ownerId, name: 'Concurrent participants',
    }).returning().get()!
    const add = (names: string[]) => fetch(`${baseUrl}/api/encounters/${encounter.id}/combatants`, {
      method: 'POST', headers: { cookie: cookies.owner, 'content-type': 'application/json' },
      body: JSON.stringify({ participants: names.map(name => ({ name })) }),
    })
    // Warm the route before deliberately holding the separate fixture connection's write lock.
    expect((await add(['Existing'])).status).toBe(200)
    let pending!: Promise<Response>
    db.$client.exec('BEGIN IMMEDIATE')
    try {
      db.update(tables.campaignEncounter).set({ notes: 'Concurrent change' }).where(eq(tables.campaignEncounter.id, encounter.id)).run()
      pending = add(['One', 'Two'])
      await delay(250)
      db.$client.exec('COMMIT')
    } catch (error) {
      db.$client.exec('ROLLBACK')
      throw error
    }
    const response = await pending
    const payload = await response.json()
    expect(response.status, JSON.stringify(payload.error)).toBe(200)
    expect(payload.data.notes).toBe('Concurrent change')
    const participants = db.query.encounterCombatant.findMany({ where: eq(tables.encounterCombatant.encounterId, encounter.id), orderBy: [asc(tables.encounterCombatant.sortOrder)] }).sync()
    expect(participants.map(({ name, sortOrder }) => ({ name, sortOrder }))).toEqual([
      { name: 'Existing', sortOrder: 0 }, { name: 'One', sortOrder: 1 }, { name: 'Two', sortOrder: 2 },
    ])
    expect(db.select({ count: count() }).from(tables.encounterEvent).where(eq(tables.encounterEvent.encounterId, encounter.id)).get()!.count).toBe(3)

    // Recheck the phase after the writer commits, preserving its timestamp on rejection.
    db.$client.exec('BEGIN IMMEDIATE')
    let completed!: typeof tables.campaignEncounter.$inferSelect
    try {
      completed = db.update(tables.campaignEncounter).set({ status: 'COMPLETED' }).where(eq(tables.campaignEncounter.id, encounter.id)).returning().get()!
      pending = add(['Too late'])
      await delay(250)
      db.$client.exec('COMMIT')
    } catch (error) {
      db.$client.exec('ROLLBACK')
      throw error
    }
    const rejected = await pending
    expect(rejected.status).toBe(409)
    expect((await rejected.json()).error.code).toBe('ENCOUNTER_ACTION_UNAVAILABLE')
    const stored = (db.query.campaignEncounter.findFirst({ where: eq(tables.campaignEncounter.id, encounter.id) }).sync()!)
    expect(stored.updatedAt).toEqual(completed.updatedAt)
    expect(db.select({ count: count() }).from(tables.encounterCombatant).where(eq(tables.encounterCombatant.encounterId, encounter.id)).get()!.count).toBe(3)
    expect(db.select({ count: count() }).from(tables.encounterEvent).where(eq(tables.encounterEvent.encounterId, encounter.id)).get()!.count).toBe(3)
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

    const start = await fetch(`${baseUrl}/api/encounters/${encounterId}`, {
      method: 'PATCH',
      headers: { cookie: cookies.owner, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    })
    expect(start.status).toBe(200)

    const ownerDamage = await fetch(`${baseUrl}/api/encounters/${encounterId}/combatants/${combatantId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ operation: 'damage', amount: 5 }),
    })
    expect(ownerDamage.status).toBe(200)

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

    expect((await fetch(`${baseUrl}/api/encounters/${encounterId}`, {
      method: 'PATCH', headers: { cookie: cookies.owner, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'start' }),
    })).status).toBe(200)

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

    const createTemplate = await fetch(`${baseUrl}/api/campaigns/${campaignId}/encounters/templates`, {
      method: 'POST',
      headers: { cookie: cookies.owner, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Template participant workflow' }),
    })
    expect(createTemplate.status).toBe(200)
    const template = (await createTemplate.json()).data
    for (const combatants of [[{ name: 'Template goblin', sortOrder: 0 }], []]) {
      const updateTemplate = await fetch(`${baseUrl}/api/encounters/templates/${template.id}`, {
        method: 'PATCH',
        headers: { cookie: cookies.owner, 'content-type': 'application/json' },
        body: JSON.stringify({ combatants }),
      })
      expect(updateTemplate.status).toBe(200)
      const updatedTemplate = (await updateTemplate.json()).data
      expect(updatedTemplate.combatants.map((combatant: { name: string }) => combatant.name)).toEqual(combatants.map((combatant) => combatant.name))
      expect(updatedTemplate.name).toBe(template.name)
      expect(updatedTemplate.updatedAt).toBe(template.updatedAt)
    }

  })

  it('runs phase-aware batches, preserves turn identity and protects finished records', async () => {
    const owner = (db.query.user.findFirst({ where: eq(tables.user.email, users.owner.email) }).sync()!)
    const enc = db.insert(tables.campaignEncounter).values({ campaignId, createdByUserId: owner.id, name: 'Phase workflow' }).returning().get()!
    const call = async (suffix: string, body: unknown, status = 200, method = 'PATCH') => {
      const response = await fetch(`${baseUrl}/api/encounters/${enc.id}${suffix}`, { method, headers: { cookie: cookies.owner, 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const json = await response.json()
      expect(response.status, JSON.stringify(json)).toBe(status)
      return json.data
    }
    await call('', { action: 'start' }, 409)
    await call('/turn', { action: 'set-active', combatantId: 'missing' }, 409)
    await call('/combatants', { participants: [{ name: 'First', maxHp: 20 }, { name: 'Second', maxHp: 15 }] }, 200, 'POST')
    const initial = db.query.encounterCombatant.findMany({ where: eq(tables.encounterCombatant.encounterId, enc.id), orderBy: [asc(tables.encounterCombatant.sortOrder)] }).sync()
    const ids = initial.map(p => p.id)
    await call('/combatants', { participants: [{ name: 'Rollback' }, { name: 'Invalid', sourceStatBlockId: 'missing' }] }, 400, 'POST')
    expect(db.select({ count: count() }).from(tables.encounterCombatant).where(eq(tables.encounterCombatant.encounterId, enc.id)).get()!.count).toBe(2)
    await call('/combatants', { action: 'damage', participantIds: ids, amount: 2 }, 409)
    const started = await call('', { action: 'start' })
    expect(started).toMatchObject({ status: 'ACTIVE', activeParticipantId: ids[0], availableActions: { turn: { allowed: true } } })
    await call('/combatants', { action: 'damage', participantIds: [ids[0], 'foreign'], amount: 2 }, 404)
    expect(((db.query.encounterCombatant.findFirst({ where: eq(tables.encounterCombatant.id, ids[0]) }).sync()!)).currentHp).toBe(20)
    const damaged = await call('/combatants', { action: 'damage', participantIds: ids, amount: 3 })
    expect(damaged.combatants.map((p: { currentHp: number }) => p.currentHp)).toEqual([17, 12])
    const reordered = await call('/initiative', { action: 'reorder', combatantOrder: [...ids].reverse() })
    expect(reordered.activeParticipantId).toBe(ids[0])
    await call('/initiative', { action: 'reorder', combatantOrder: [ids[0], ids[0]] }, 400)
    await call('/combatants', { action: 'condition-add', participantIds: ids, condition: { name: 'Marked', duration: 3, tickTiming: 'ROUND_END' } })
    await call('/combatants', { action: 'damage', participantIds: ids, amount: 0 }, 400)
    await call('/combatants', { action: 'condition-add', participantIds: ids, condition: { name: 'Invalid', duration: -1 } }, 400)
    await call('', { action: 'pause' })
    await call('/turn', { action: 'advance' }, 409)
    expect((db.query.encounterCondition.findMany({ where: inArray(tables.encounterCondition.combatantId, ids) }).sync()).every(c => c.remaining === 3)).toBe(true)
    await call('/combatants', { action: 'heal', participantIds: ids, amount: 1 })
    await call('', { action: 'resume' })
    await call('/turn', { action: 'advance' })
    expect((db.query.encounterCondition.findMany({ where: inArray(tables.encounterCondition.combatantId, ids) }).sync()).every(c => c.remaining === 2)).toBe(true)
    await call('', { action: 'complete' })
    await call('/combatants', { participants: [{ name: 'Forbidden' }] }, 409, 'POST')
    await call(`/combatants/${ids[0]}`, { side: 'ALLY' }, 409)
    await call('', { name: 'Forbidden' }, 409)
    await call('', { action: 'start' }, 409)
    await call('', { status: 'ACTIVE' }, 400)
    await call('', { action: 'reset' }, 409)
    const reopened = await call('', { action: 'reopen' })
    expect(reopened.status).toBe('PAUSED')
    expect(reopened.currentRound).toBe(2)
    await call('/turn', { action: 'advance' }, 409)
    const view = await fetch(`${baseUrl}/api/encounters/${enc.id}`, { headers: { cookie: cookies.viewer } })
    expect(Object.values((await view.json()).data.availableActions).every((a: unknown) => !(a as { allowed: boolean }).allowed)).toBe(true)
  })

  it('rolls and clears individual or all initiatives without losing turn identity', async () => {
    const send = (path: string, body: unknown, method = 'PATCH') => fetch(`${baseUrl}/api/${path}`, {
      method, headers: { cookie: cookies.owner, 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    const created = await send(`campaigns/${campaignId}/encounters`, { name: 'Initiative controls' }, 'POST')
    const createdPayload = await created.json()
    expect(created.status, JSON.stringify(createdPayload.error)).toBe(200)
    const id = createdPayload.data.id
    const added = await send(`encounters/${id}/combatants`, {
      participants: [
        { name: 'One', initiative: 10 }, { name: 'Two', initiative: 20 },
      ]
    }, 'POST')
    const addedPayload = await added.json()
    expect(added.status, JSON.stringify(addedPayload.error)).toBe(200)
    const [one, two] = addedPayload.data.combatants
    await send(`encounters/${id}`, { action: 'start' })
    const rolled = await send(`encounters/${id}/initiative`, { action: 'roll', combatantId: one.id })
    expect(rolled.status).toBe(200)
    const state = (await rolled.json()).data
    expect(state.combatants.find((p: { id: string }) => p.id === one.id).initiative).toBeGreaterThanOrEqual(1)
    expect(state.combatants.find((p: { id: string }) => p.id === one.id).initiative).toBeLessThanOrEqual(20)
    expect(state.combatants.find((p: { id: string }) => p.id === two.id).initiative).toBe(20)
    expect(state.activeParticipantId).toBe(one.id)
    const cleared = await send(`encounters/${id}/initiative`, { action: 'clear', combatantId: one.id })
    expect(cleared.status).toBe(200)
    const single = (await cleared.json()).data
    expect(single.combatants.find((p: { id: string }) => p.id === one.id).initiative).toBeNull()
    expect(single.combatants.find((p: { id: string }) => p.id === two.id).initiative).toBe(20)
    const all = await send(`encounters/${id}/initiative`, { action: 'clear' })
    const final = (await all.json()).data
    expect(final.combatants.every((p: { initiative: number | null }) => p.initiative === null)).toBe(true)
    expect(final.combatants.map((p: { id: string }) => p.id)).toEqual(state.combatants.map((p: { id: string }) => p.id))
    expect(final.activeParticipantId).toBe(one.id)
    expect((await send(`encounters/${id}/initiative`, { action: 'roll', combatantId: 'foreign' })).status).toBe(404)
    expect((await send(`encounters/${id}/initiative`, { action: 'clear', combatantId: 'foreign' })).status).toBe(404)
    await send(`encounters/${id}`, { action: 'complete' })
    expect((await send(`encounters/${id}/initiative`, { action: 'clear' })).status).toBe(409)
  })

  it('validates session and calendar linking rules on create', async () => {
    const owner = (db.query.user.findFirst({ where: eq(tables.user.email, users.owner.email), columns: { id: true } }).sync() ?? null)
    expect(owner?.id).toBeTruthy()

    const foreignCampaign = db.insert(tables.campaign).values({
      ownerId: owner!.id,
      name: 'Encounter Foreign Campaign',
    }).returning().get()!
    const foreignSession = db.insert(tables.session).values({
      campaignId: foreignCampaign.id,
      title: 'Foreign Session',
    }).returning().get()!

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

    db.insert(tables.campaignCalendarConfig).values({
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
    }).onConflictDoUpdate({
      target: tables.campaignCalendarConfig.campaignId, set: {
        isEnabled: true,
        monthsJson: [{ length: 30 }],
      }
    }).returning().get()!

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
    expect(invalidTransition.status).toBe(400)

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
