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

const throttleProbeHeaders = { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.77' }

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
    const payload = await response.json()
    expect(payload).toEqual({ data: null, error: { code: 'UNAUTHORIZED', message: expect.any(String) } })
  })

  it('wraps validation failures in the API error envelope', async () => {
    const response = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { cookie: authCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ system: 'D&D 5e' }),
    })
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.data).toBeNull()
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.fields.name).toBeTruthy()
  })

  it('wraps not-found failures in the API error envelope', async () => {
    const response = await fetch(`${baseUrl}/api/campaigns/does-not-exist`, {
      headers: { cookie: authCookie },
    })
    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload).toEqual({ data: null, error: { code: 'NOT_FOUND', message: 'Campaign not found' } })
  })

  it('logs in and returns session user', async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: authCookie },
    })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data.user).toEqual({
      id: expect.any(String),
      email: testUser.email,
      name: testUser.name,
      systemRole: 'USER',
      avatarUrl: null,
    })
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

  // Exhaust three real HTTP rate-limit budgets, including a password verification.
  it('applies endpoint throttling to register/login/invite-accept endpoints', { timeout: 15_000 }, async () => {
    let registerRateLimited = false
    for (let i = 0; i < 20; i += 1) {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: throttleProbeHeaders,
        body: JSON.stringify({}),
      })
      if (response.status === 429) {
        registerRateLimited = true
        break
      }
    }
    expect(registerRateLimited).toBe(true)

    let loginRateLimited = false
    for (let i = 0; i < 30; i += 1) {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: throttleProbeHeaders,
        // One real rejection covers credentials; malformed attempts still consume the IP budget.
        body: JSON.stringify(i === 0 ? {
          email: testUser.email,
          password: 'bad-password',
        } : {}),
      })
      if (response.status === 429) {
        loginRateLimited = true
        break
      }
      expect(response.status).toBe(i === 0 ? 401 : 400)
    }
    expect(loginRateLimited).toBe(true)

    const blockedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: throttleProbeHeaders,
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    })
    expect(blockedLogin.status).toBe(429)
    expect(Number(blockedLogin.headers.get('retry-after'))).toBeGreaterThan(0)

    let inviteAcceptRateLimited = false
    for (let i = 0; i < 30; i += 1) {
      const response = await fetch(`${baseUrl}/api/campaigns/invites/rate-limit-probe-token/accept`, {
        method: 'POST',
        headers: {
          cookie: authCookie,
          'x-forwarded-for': '203.0.113.77',
        },
      })
      if (response.status === 429) {
        inviteAcceptRateLimited = true
        break
      }
    }
    expect(inviteAcceptRateLimited).toBe(true)
  })
})
