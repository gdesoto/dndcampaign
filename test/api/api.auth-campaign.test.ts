// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'
import { ofetch } from 'ofetch'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const prisma = createApiTestPrismaClient()
const hash = new Hash(new Scrypt())
const baseUrl = getApiTestBaseUrl()

const testUser = {
  email: 'test-dm@example.com',
  password: 'password123',
  name: 'Test DM',
}
const authHeaders = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.10',
}

const sleep = (ms: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))

const loginAndGetCookie = async (email: string, password: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email, password }),
    })
    if (loginResponse.status === 429) {
      await sleep(250)
      continue
    }
    expect(loginResponse.status).toBe(200)
    return loginResponse.headers.get('set-cookie') || ''
  }
  throw new Error(`Rate-limited while logging in test user ${email}`)
}

describe('auth + campaigns API', () => {
  let authCookie = ''

  beforeAll(async () => {
    const passwordHash = await hash.make(testUser.password)
    const user = await prisma.user.upsert({
      where: { email: testUser.email },
      update: {
        passwordHash,
        name: testUser.name,
      },
      create: {
        email: testUser.email,
        passwordHash,
        name: testUser.name,
      },
    })

    await prisma.campaign.deleteMany({ where: { ownerId: user.id } })
    await prisma.campaign.create({
      data: {
        ownerId: user.id,
        name: 'Test Campaign',
        system: 'D&D 5e',
        description: 'Seeded for API tests.',
      },
    })

    authCookie = await loginAndGetCookie(testUser.email, testUser.password)
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('rejects campaign list without auth', async () => {
    const response = await fetch(`${baseUrl}/api/campaigns`)
    expect(response.status).toBe(401)
  })

  it('logs in and returns session user', async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: authCookie },
    })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data.user.email).toBe(testUser.email)
  })

  it('lists campaigns for authenticated user', async () => {
    const payload = await ofetch(`${baseUrl}/api/campaigns`, {
      headers: { cookie: authCookie },
    })
    expect(payload.data.length).toBeGreaterThan(0)
    expect(payload.data[0].name).toBe('Test Campaign')
  })

  it('creates a campaign for authenticated user', async () => {
    const payload = await ofetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { cookie: authCookie },
      body: {
        name: 'API Created Campaign',
        system: 'D&D 5e',
        description: 'Created in test',
      },
    })
    expect(payload.data.name).toBe('API Created Campaign')
  })
})







