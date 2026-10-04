// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestDatabase } from '../scripts/db-test-client'
import * as tables from '../../server/db/schema'
import { eq } from 'drizzle-orm'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const db = createApiTestDatabase()
const hash = new Hash(new Scrypt({}))
const baseUrl = getApiTestBaseUrl()

const ownerUser = {
  email: 'milestone-owner@example.com',
  password: 'milestone-owner-pass',
  name: 'Milestone Owner',
}

const authHeaders = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.20',
}

const sleep = (ms: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))

const loginAndGetCookie = async (email: string, password: string) => {
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

describe('milestone API routes', () => {
  let ownerId = ''
  let ownerCookie = ''
  let campaignId = ''

  beforeAll(async () => {
    const ownerPasswordHash = await hash.make(ownerUser.password)

    const owner = db.insert(tables.user).values({
      email: ownerUser.email,
      passwordHash: ownerPasswordHash,
      name: ownerUser.name,
    }).onConflictDoUpdate({
      target: tables.user.email, set: {
        passwordHash: ownerPasswordHash,
        name: ownerUser.name,
      }
    }).returning().get()!
    ownerId = owner.id

    db.delete(tables.campaign).where(eq(tables.campaign.ownerId, ownerId)).run()

    const campaign = db.insert(tables.campaign).values({
      ownerId,
      name: 'Milestone Route Test Campaign',
      system: 'D&D 5e',
      description: 'Campaign for milestone route tests.',
    }).returning().get()!
    campaignId = campaign.id

    ownerCookie = await loginAndGetCookie(ownerUser.email, ownerUser.password)
  }, 120_000)

  beforeEach(async () => {
    db.delete(tables.milestone).where(eq(tables.milestone.campaignId, campaignId)).run()
  })

  afterAll(async () => {
    db.$client.close()
  })

  it('allows a content writer to delete a milestone', async () => {
    const milestone = db.insert(tables.milestone).values({
      campaignId,
      title: 'Recover the relic',
      description: 'Milestone to delete in the route test.',
    }).returning().get()!

    const response = await fetch(`${baseUrl}/api/milestones/${milestone.id}`, {
      method: 'DELETE',
      headers: { cookie: ownerCookie },
    })

    expect(response.status).toBe(200)
    expect((db.query.milestone.findFirst({ where: eq(tables.milestone.id, milestone.id) }).sync() ?? null)).toBeNull()
  })

  it('rejects milestone deletion without authentication', async () => {
    const milestone = db.insert(tables.milestone).values({
      campaignId,
      title: 'Defend the village',
    }).returning().get()!

    const response = await fetch(`${baseUrl}/api/milestones/${milestone.id}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(401)
    expect((db.query.milestone.findFirst({ where: eq(tables.milestone.id, milestone.id) }).sync() ?? null)).not.toBeNull()
  })
})
