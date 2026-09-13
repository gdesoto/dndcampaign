// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'

const prisma = createApiTestPrismaClient()

const registerUser = {
  name: 'UM1 Tester',
  email: 'um1@example.com',
  password: 'strongpass123',
}
const authHeaders = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.11',
}

describe('user management UM-1', () => {
  const baseUrl = getApiTestBaseUrl()
  let authCookie = ''

  beforeAll(async () => {
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('registers a user and creates a session', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders,
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
    expect(mePayload.data.user).toEqual({
      id: expect.any(String),
      email: registerUser.email,
      name: registerUser.name,
      systemRole: 'USER',
      avatarUrl: null,
    })
  })

  it('returns 409 for duplicate registration email', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders,
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
      headers: authHeaders,
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
    const profileResponse = await fetch(`${baseUrl}/api/account`, {
      headers: { cookie: authCookie },
    })

    expect(profileResponse.status).toBe(200)
    const profilePayload = await profileResponse.json()
    const profile = profilePayload.data.profile
    expect(profile).toEqual({
      id: expect.any(String),
      email: registerUser.email,
      name: registerUser.name,
      systemRole: 'USER',
      avatarUrl: null,
      isActive: true,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })

    const patchResponse = await fetch(`${baseUrl}/api/account`, {
      method: 'PATCH',
      headers: {
        cookie: authCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update-profile',
        name: 'Updated UM1 Tester',
        avatarUrl: 'https://example.com/avatar.png',
      }),
    })

    expect(patchResponse.status).toBe(200)
    const patchPayload = await patchResponse.json()
    expect(patchPayload.data.profile).toEqual({
      ...profile,
      name: 'Updated UM1 Tester',
      avatarUrl: 'https://example.com/avatar.png',
      updatedAt: expect.any(String),
    })
    expect(Number.isNaN(Date.parse(patchPayload.data.profile.updatedAt))).toBe(false)

    const refreshedProfileResponse = await fetch(`${baseUrl}/api/account`, {
      headers: { cookie: authCookie },
    })
    expect(refreshedProfileResponse.status).toBe(200)
    const refreshedProfilePayload = await refreshedProfileResponse.json()
    expect(refreshedProfilePayload.data.profile).toEqual(patchPayload.data.profile)
  })

  it('does not expose the retired account profile endpoint', async () => {
    const response = await fetch(`${baseUrl}/api/account/profile`, {
      headers: { cookie: authCookie },
    })

    expect(response.status).toBe(404)
  })

  it('changes email with password re-auth', async () => {
    const response = await fetch(`${baseUrl}/api/account`, {
      method: 'PATCH',
      headers: {
        cookie: authCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'change-email',
        newEmail: 'um1-updated@example.com',
        password: registerUser.password,
      }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data.email).toBe('um1-updated@example.com')
  })

  it('changes password and allows login with new password', async () => {
    const changeResponse = await fetch(`${baseUrl}/api/account`, {
      method: 'PATCH',
      headers: {
        cookie: authCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'change-password',
        currentPassword: registerUser.password,
        newPassword: 'strongpass12345',
      }),
    })

    expect(changeResponse.status).toBe(200)

    const oldPasswordLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        email: 'um1-updated@example.com',
        password: registerUser.password,
      }),
    })
    expect(oldPasswordLogin.status).toBe(401)

    const newPasswordLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: authHeaders,
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

    const revokeResponse = await fetch(`${baseUrl}/api/account`, {
      method: 'PATCH',
      headers: {
        cookie: authCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'revoke-other-sessions' }),
    })
    expect(revokeResponse.status).toBe(200)
    const revokePayload = await revokeResponse.json()
    expect(typeof revokePayload.data.revokedSessions).toBe('number')
  })

  it('requires authentication for account profile endpoints', async () => {
    const response = await fetch(`${baseUrl}/api/account`)
    expect(response.status).toBe(401)
  })

  it('updates lastLoginAt after successful login', async () => {
    const userBefore = await prisma.user.findUnique({
      where: { email: 'um1-updated@example.com' },
      select: { lastLoginAt: true },
    })

    await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: authHeaders,
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

  it('clears inactive, deleted, and missing account sessions before returning unauthorized', async () => {
    const assertUnauthorizedAndCleared = async (cookie: string) => {
      const response = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { cookie },
      })

      expect(response.status).toBe(401)
      expect(response.headers.get('set-cookie')).toContain('nuxt-session=;')
      const payload = await response.json()
      expect(payload.error.code).toBe('UNAUTHORIZED')
    }

    await prisma.user.update({
      where: { email: 'um1-updated@example.com' },
      data: { isActive: false },
    })
    await assertUnauthorizedAndCleared(authCookie)

    await prisma.user.update({
      where: { email: 'um1-updated@example.com' },
      data: { isActive: true, deletedAt: new Date() },
    })
    await assertUnauthorizedAndCleared(authCookie)

    const missingResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Missing UM1 Tester',
        email: 'missing-um1@example.com',
        password: registerUser.password,
        termsAccepted: true,
      }),
    })
    expect(missingResponse.status).toBe(200)
    const missingCookie = missingResponse.headers.get('set-cookie') || ''
    const missingPayload = await missingResponse.json()
    await prisma.user.delete({ where: { id: missingPayload.data.user.id } })
    await assertUnauthorizedAndCleared(missingCookie)
  })
})







