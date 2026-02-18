// @vitest-environment node
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ofetch } from 'ofetch'
import { PrismaClient } from '@prisma/client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { createTestDbContext } from '../scripts/test-db-utils.mjs'
import { startManagedNuxtDevServer } from '../scripts/nuxt-server-utils.mjs'

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const db = createTestDbContext({
  rootDir,
  prefix: 'api',
  sessionPassword: 'api-session-password-1234567890-abcdefghijklmnopqrstuvwxyz',
})

const env = {
  ...db.env,
  VITE_HMR_PORT: '24679',
  VITE_HMR_HOST: '127.0.0.1',
}

const prisma = new PrismaClient({ datasourceUrl: db.dbUrl })
const hash = new Hash(new Scrypt())
let baseUrl = ''
let stopServer = async () => {}

const testUser = {
  email: 'test-dm@example.com',
  password: 'password123',
  name: 'Test DM',
}

describe('auth + campaigns API', () => {
  let authCookie = ''

  beforeAll(async () => {
    db.prepare({ migrate: true, seed: false, stdio: 'pipe' })

    const server = await startManagedNuxtDevServer({
      rootDir,
      port: 4174,
      env,
    })
    baseUrl = server.baseUrl
    stopServer = server.stop

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

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    })
    authCookie = loginResponse.headers.get('set-cookie') || ''
  }, 120_000)

  afterAll(async () => {
    await stopServer()
    await prisma.$disconnect()
    await db.cleanup()
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
