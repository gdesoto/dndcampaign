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

describe('milestone API routes', () => {
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
        name: 'Milestone Route Test Campaign',
        system: 'D&D 5e',
        description: 'Campaign for milestone route tests.',
      },
    })
    campaignId = campaign.id

    ownerCookie = await loginAndGetCookie(ownerUser.email, ownerUser.password)
  }, 120_000)

  beforeEach(async () => {
    await prisma.milestone.deleteMany({ where: { campaignId } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('allows a content writer to delete a milestone', async () => {
    const milestone = await prisma.milestone.create({
      data: {
        campaignId,
        title: 'Recover the relic',
        description: 'Milestone to delete in the route test.',
      },
    })

    const response = await fetch(`${baseUrl}/api/milestones/${milestone.id}`, {
      method: 'DELETE',
      headers: { cookie: ownerCookie },
    })

    expect(response.status).toBe(200)
    await expect(prisma.milestone.findUnique({ where: { id: milestone.id } })).resolves.toBeNull()
  })

  it('rejects milestone deletion without authentication', async () => {
    const milestone = await prisma.milestone.create({
      data: {
        campaignId,
        title: 'Defend the village',
      },
    })

    const response = await fetch(`${baseUrl}/api/milestones/${milestone.id}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(401)
    await expect(prisma.milestone.findUnique({ where: { id: milestone.id } })).resolves.not.toBeNull()
  })
})
