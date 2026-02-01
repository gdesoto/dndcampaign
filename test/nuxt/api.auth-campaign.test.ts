// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import {
  createTestContext,
  setTestContext,
  startServer,
  stopServer,
  $fetch,
  fetch,
} from '@nuxt/test-utils/e2e'
import { PrismaClient } from '@prisma/client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const testDbUrl = 'file:./db/test.db'
const sessionPassword = 'test-session-password-1234567890'

const env = {
  ...process.env,
  DATABASE_URL: testDbUrl,
  NUXT_SESSION_PASSWORD: sessionPassword,
  VITE_HMR_PORT: '24679',
  VITE_HMR_HOST: '127.0.0.1',
}

process.env.DATABASE_URL = testDbUrl
process.env.NUXT_SESSION_PASSWORD = sessionPassword

rmSync(resolve(rootDir, 'db', 'test.db'), { force: true })
execSync('npx prisma migrate deploy', {
  cwd: rootDir,
  env: { ...env, RUST_LOG: 'debug' },
  stdio: 'pipe',
  shell: true,
})

const ctx = createTestContext({
  rootDir,
  server: true,
  dev: true,
  env,
})

ctx.nuxt = { options: { rootDir, app: { baseURL: '/' } } }
setTestContext(ctx)

const prisma = new PrismaClient()
const hash = new Hash(new Scrypt())

const testUser = {
  email: 'test-dm@example.com',
  password: 'password123',
  name: 'Test DM',
}

afterAll(async () => {
  await stopServer()
  await prisma.$disconnect()
  rmSync(resolve(rootDir, 'db', 'test.db'), { force: true })
})

describe('auth + campaigns API', () => {
  let authCookie = ''

  beforeAll(async () => {
    await startServer()

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

    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    })
    authCookie = loginResponse.headers.get('set-cookie') || ''
  }, 60000)

  it('rejects campaign list without auth', async () => {
    const response = await fetch('/api/campaigns')
    expect(response.status).toBe(401)
  })

  it('logs in and returns session user', async () => {
    const response = await fetch('/api/auth/me', {
      headers: { cookie: authCookie },
    })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data.user.email).toBe(testUser.email)
  })

  it('lists campaigns for authenticated user', async () => {
    const payload = await $fetch('/api/campaigns', {
      headers: { cookie: authCookie },
    })
    expect(payload.data.length).toBeGreaterThan(0)
    expect(payload.data[0].name).toBe('Test Campaign')
  })

  it('creates a campaign for authenticated user', async () => {
    const payload = await $fetch('/api/campaigns', {
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
