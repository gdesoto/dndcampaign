// @vitest-environment node
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { getApiTestBaseUrl, getApiTestDatabaseUrl } from '../scripts/api-test-context.mjs'

const prisma = new PrismaClient({ datasourceUrl: getApiTestDatabaseUrl() })
const hash = new Hash(new Scrypt())

const password = 'um7-password-12345'
const baseUrl = getApiTestBaseUrl()
const throttleProbeHeaders = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.77',
}
const authHeaders = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.17',
}

const users = {
  owner: { email: 'um7-owner@example.com', name: 'UM7 Owner', systemRole: 'USER' as const },
  viewer: { email: 'um7-viewer@example.com', name: 'UM7 Viewer', systemRole: 'USER' as const },
  outsider: { email: 'um7-outsider@example.com', name: 'UM7 Outsider', systemRole: 'USER' as const },
  invitee: { email: 'um7-invitee@example.com', name: 'UM7 Invitee', systemRole: 'USER' as const },
  admin: { email: 'um7-admin@example.com', name: 'UM7 Admin', systemRole: 'SYSTEM_ADMIN' as const },
}

const cookies: Record<string, string> = {}
const userIds: Record<string, string> = {}

let campaignId = ''
let viewerMemberId = ''
let campaignArtifactId = ''

const sleep = (ms: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))

const loginAndGetCookie = async (email: string) => {
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

  throw new Error(`Rate-limited while logging in test user ${email}`)
}

describe('user management UM-7 hardening, audit, and release readiness', () => {
  beforeAll(async () => {
    const passwordHash = await hash.make(password)

    for (const [key, user] of Object.entries(users)) {
      const created = await prisma.user.create({
        data: {
          email: user.email,
          name: user.name,
          passwordHash,
          systemRole: user.systemRole,
          lastLoginAt: new Date(),
        },
        select: { id: true },
      })
      userIds[key] = created.id
    }

    const campaign = await prisma.campaign.create({
      data: {
        ownerId: userIds.owner,
        name: 'UM7 Hardening Campaign',
        members: {
          create: [
            {
              userId: userIds.owner,
              role: 'OWNER',
              invitedByUserId: userIds.owner,
            },
            {
              userId: userIds.viewer,
              role: 'VIEWER',
              invitedByUserId: userIds.owner,
            },
          ],
        },
      },
      select: { id: true },
    })
    campaignId = campaign.id

    const viewerMember = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId,
          userId: userIds.viewer,
        },
      },
      select: { id: true },
    })
    viewerMemberId = viewerMember?.id || ''

    const session = await prisma.session.create({
      data: {
        campaignId,
        title: 'UM7 Session',
      },
      select: { id: true },
    })

    const artifact = await prisma.artifact.create({
      data: {
        ownerId: userIds.owner,
        campaignId,
        provider: 'LOCAL',
        storageKey: `um7/${campaignId}/campaign-audio.mp3`,
        mimeType: 'audio/mpeg',
        byteSize: 128,
      },
      select: { id: true },
    })
    campaignArtifactId = artifact.id

    await prisma.recording.create({
      data: {
        sessionId: session.id,
        kind: 'AUDIO',
        filename: 'campaign-audio.mp3',
        mimeType: 'audio/mpeg',
        byteSize: 128,
        artifactId: artifact.id,
      },
    })

    for (const [key, value] of Object.entries(users)) {
      cookies[key] = await loginAndGetCookie(value.email)
    }
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('enforces campaign artifact ACL for members and non-members', async () => {
    const viewerRes = await fetch(`${baseUrl}/api/artifacts/${campaignArtifactId}`, {
      headers: { cookie: cookies.viewer },
    })
    expect(viewerRes.status).toBe(200)

    const outsiderRes = await fetch(`${baseUrl}/api/artifacts/${campaignArtifactId}`, {
      headers: { cookie: cookies.outsider },
    })
    expect(outsiderRes.status).toBe(403)

    const adminRes = await fetch(`${baseUrl}/api/artifacts/${campaignArtifactId}`, {
      headers: { cookie: cookies.admin },
    })
    expect(adminRes.status).toBe(200)
  })

  it('stores invite tokens hashed and enforces expiry', async () => {
    const inviteRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/members/invites`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: users.invitee.email,
        role: 'VIEWER',
      }),
    })
    expect(inviteRes.status).toBe(200)
    const invitePayload = await inviteRes.json()
    const inviteToken = invitePayload.data.inviteToken as string
    expect(inviteToken).toBeTruthy()

    const inviteRow = await prisma.campaignInvite.findFirst({
      where: {
        campaignId,
        email: users.invitee.email,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        tokenHash: true,
        expiresAt: true,
      },
    })

    expect(inviteRow).toBeTruthy()
    expect(inviteRow?.tokenHash).not.toBe(inviteToken)
    expect(inviteRow?.tokenHash.length).toBe(64)
    expect(inviteRow?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000)

    const expiredToken = 'um7-expired-invite-token'
    const expiredTokenHash = createHash('sha256').update(expiredToken).digest('hex')
    const expiredInvite = await prisma.campaignInvite.create({
      data: {
        campaignId,
        email: users.invitee.email,
        role: 'VIEWER',
        tokenHash: expiredTokenHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 60_000),
        invitedByUserId: userIds.owner,
      },
      select: { id: true },
    })

    const acceptExpiredRes = await fetch(`${baseUrl}/api/campaign-invites/${expiredToken}/accept`, {
      method: 'POST',
      headers: {
        cookie: cookies.invitee,
      },
    })
    expect(acceptExpiredRes.status).toBe(410)

    const updatedExpiredInvite = await prisma.campaignInvite.findUnique({
      where: { id: expiredInvite.id },
      select: { status: true },
    })
    expect(updatedExpiredInvite?.status).toBe('EXPIRED')
  })

  it('applies endpoint throttling to register/login/invite-accept endpoints', async () => {
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
        body: JSON.stringify({
          email: users.owner.email,
          password: 'bad-password',
        }),
      })
      if (response.status === 429) {
        loginRateLimited = true
        break
      }
    }
    expect(loginRateLimited).toBe(true)

    let inviteAcceptRateLimited = false
    for (let i = 0; i < 30; i += 1) {
      const response = await fetch(`${baseUrl}/api/campaign-invites/rate-limit-probe-token/accept`, {
        method: 'POST',
        headers: {
          cookie: cookies.invitee,
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

  it('writes activity logs for membership, public-access, and admin actions', async () => {
    const roleUpdateRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/members/${viewerMemberId}`,
      {
        method: 'PATCH',
        headers: {
          cookie: cookies.owner,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ role: 'COLLABORATOR' }),
      }
    )
    expect(roleUpdateRes.status).toBe(200)

    const publicUpdateRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        isEnabled: true,
        showSessions: true,
      }),
    })
    expect(publicUpdateRes.status).toBe(200)

    const adminUpdateRes = await fetch(`${baseUrl}/api/admin/users/${userIds.outsider}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.admin,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        isActive: false,
      }),
    })
    expect(adminUpdateRes.status).toBe(200)

    const actions = await prisma.activityLog.findMany({
      where: {
        action: {
          in: [
            'CAMPAIGN_MEMBER_ROLE_UPDATED',
            'CAMPAIGN_PUBLIC_ACCESS_UPDATED',
            'ADMIN_USER_UPDATE',
          ],
        },
      },
      select: {
        action: true,
      },
    })

    const actionSet = new Set(actions.map((entry) => entry.action))
    expect(actionSet.has('CAMPAIGN_MEMBER_ROLE_UPDATED')).toBe(true)
    expect(actionSet.has('CAMPAIGN_PUBLIC_ACCESS_UPDATED')).toBe(true)
    expect(actionSet.has('ADMIN_USER_UPDATE')).toBe(true)
  })

  it('exposes filterable activity logs in admin API', async () => {
    const unauthorizedRes = await fetch(`${baseUrl}/api/admin/activity`, {
      headers: {
        cookie: cookies.viewer,
      },
    })
    expect(unauthorizedRes.status).toBe(403)

    const adminRes = await fetch(
      `${baseUrl}/api/admin/activity?scope=ADMIN&search=ADMIN_USER_UPDATE&page=1&pageSize=20`,
      {
        headers: {
          cookie: cookies.admin,
        },
      }
    )
    expect(adminRes.status).toBe(200)
    const payload = await adminRes.json()
    expect(Array.isArray(payload.data.logs)).toBe(true)
    expect(payload.data.logs.length).toBeGreaterThan(0)
    expect(payload.data.logs.every((entry: { scope: string }) => entry.scope === 'ADMIN')).toBe(true)
    expect(
      payload.data.logs.some((entry: { action: string }) => entry.action === 'ADMIN_USER_UPDATE')
    ).toBe(true)
  })
})
