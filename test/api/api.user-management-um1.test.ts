// @vitest-environment node
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTestDbContext } from '../scripts/test-db-utils.mjs'
import { startManagedNuxtDevServer } from '../scripts/nuxt-server-utils.mjs'

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const db = createTestDbContext({
  rootDir,
  prefix: 'api-um1',
  sessionPassword: 'api-um1-session-password-1234567890-abcdefghijklmnopqrstuvwxyz',
})

const env = {
  ...db.env,
  VITE_HMR_PORT: '24680',
  VITE_HMR_HOST: '127.0.0.1',
}

const prisma = new PrismaClient({ datasourceUrl: db.dbUrl })

const registerUser = {
  name: 'UM1 Tester',
  email: 'um1@example.com',
  password: 'strongpass123',
}

describe('user management UM-1', () => {
  let baseUrl = ''
  let stopServer = async () => {}
  let authCookie = ''

  beforeAll(async () => {
    db.prepare({ migrate: true, seed: false, stdio: 'pipe' })

    const server = await startManagedNuxtDevServer({
      rootDir,
      port: 4175,
      env,
    })

    baseUrl = server.baseUrl
    stopServer = server.stop
  }, 120_000)

  afterAll(async () => {
    await stopServer()
    await prisma.$disconnect()
    await db.cleanup()
  })

  it('registers a user and creates a session', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...registerUser,
        termsAccepted: true,
      }),
    })

    expect(response.status).toBe(200)
    authCookie = response.headers.get('set-cookie') || ''
    expect(authCookie).toContain('nuxt-session')

    const payload = await response.json()
    expect(payload.data.user.email).toBe(registerUser.email)
    expect(payload.data.user.systemRole).toBe('USER')

    const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: authCookie },
    })
    expect(meResponse.status).toBe(200)
    const mePayload = await meResponse.json()
    expect(mePayload.data.user.email).toBe(registerUser.email)
  })

  it('returns 409 for duplicate registration email', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate User',
        email: registerUser.email,
        password: 'anotherpass123',
        termsAccepted: true,
      }),
    })

    expect(response.status).toBe(409)
    const payload = await response.json()
    expect(payload.error.code).toBe('EMAIL_ALREADY_IN_USE')
  })

  it('rejects weak registration password', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Weak Password User',
        email: 'weak-user@example.com',
        password: 'password123',
        termsAccepted: true,
      }),
    })

    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.fields.password).toBeTruthy()
  })

  it('gets and updates account profile', async () => {
    const profileResponse = await fetch(`${baseUrl}/api/account/profile`, {
      headers: { cookie: authCookie },
    })

    expect(profileResponse.status).toBe(200)
    const profilePayload = await profileResponse.json()
    expect(profilePayload.data.profile.email).toBe(registerUser.email)

    const patchResponse = await fetch(`${baseUrl}/api/account/profile`, {
      method: 'PATCH',
      headers: {
        cookie: authCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Updated UM1 Tester',
        avatarUrl: 'https://example.com/avatar.png',
      }),
    })

    expect(patchResponse.status).toBe(200)
    const patchPayload = await patchResponse.json()
    expect(patchPayload.data.profile.name).toBe('Updated UM1 Tester')
    expect(patchPayload.data.profile.avatarUrl).toBe('https://example.com/avatar.png')
  })

  it('changes email with password re-auth', async () => {
    const response = await fetch(`${baseUrl}/api/account/change-email`, {
      method: 'POST',
      headers: {
        cookie: authCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        newEmail: 'um1-updated@example.com',
        password: registerUser.password,
      }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data.email).toBe('um1-updated@example.com')
  })

  it('changes password and allows login with new password', async () => {
    const changeResponse = await fetch(`${baseUrl}/api/account/change-password`, {
      method: 'POST',
      headers: {
        cookie: authCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: registerUser.password,
        newPassword: 'strongpass12345',
      }),
    })

    expect(changeResponse.status).toBe(200)

    const oldPasswordLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'um1-updated@example.com',
        password: registerUser.password,
      }),
    })
    expect(oldPasswordLogin.status).toBe(401)

    const newPasswordLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'um1-updated@example.com',
        password: 'strongpass12345',
      }),
    })

    expect(newPasswordLogin.status).toBe(200)
  })

  it('lists sessions and revokes other sessions', async () => {
    const sessionsResponse = await fetch(`${baseUrl}/api/account/sessions`, {
      headers: { cookie: authCookie },
    })
    expect(sessionsResponse.status).toBe(200)
    const sessionsPayload = await sessionsResponse.json()
    expect(Array.isArray(sessionsPayload.data.sessions)).toBe(true)
    expect(sessionsPayload.data.sessions.length).toBeGreaterThan(0)

    const revokeResponse = await fetch(`${baseUrl}/api/account/sessions/revoke-others`, {
      method: 'POST',
      headers: { cookie: authCookie },
    })
    expect(revokeResponse.status).toBe(200)
    const revokePayload = await revokeResponse.json()
    expect(typeof revokePayload.data.revokedSessions).toBe('number')
  })

  it('requires authentication for account profile endpoints', async () => {
    const response = await fetch(`${baseUrl}/api/account/profile`)
    expect(response.status).toBe(401)
  })

  it('updates lastLoginAt after successful login', async () => {
    const userBefore = await prisma.user.findUnique({
      where: { email: 'um1-updated@example.com' },
      select: { lastLoginAt: true },
    })

    await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'um1-updated@example.com',
        password: 'strongpass12345',
      }),
    })

    const userAfter = await prisma.user.findUnique({
      where: { email: 'um1-updated@example.com' },
      select: { lastLoginAt: true },
    })

    expect(userAfter?.lastLoginAt).toBeTruthy()
    expect((userAfter?.lastLoginAt?.getTime() || 0) >= (userBefore?.lastLoginAt?.getTime() || 0)).toBe(true)
  })
})
