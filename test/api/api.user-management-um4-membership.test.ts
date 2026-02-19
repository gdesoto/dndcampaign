// @vitest-environment node
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { createTestDbContext } from '../scripts/test-db-utils.mjs'
import { startManagedNuxtDevServer } from '../scripts/nuxt-server-utils.mjs'

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const db = createTestDbContext({
  rootDir,
  prefix: 'api-um4',
  sessionPassword: 'api-um4-session-password-1234567890-abcdefghijklmnopqrstuvwxyz',
})

const env = {
  ...db.env,
  VITE_HMR_PORT: '24682',
  VITE_HMR_HOST: '127.0.0.1',
}

const prisma = new PrismaClient({ datasourceUrl: db.dbUrl })
const hash = new Hash(new Scrypt())

const password = 'um4-owner-password-12345'
let baseUrl = ''
let stopServer = async () => {}

const users = {
  owner: { email: 'um4-owner@example.com', name: 'UM4 Owner' },
  collaborator: { email: 'um4-collaborator@example.com', name: 'UM4 Collaborator' },
  invitee: { email: 'um4-invitee@example.com', name: 'UM4 Invitee' },
  outsider: { email: 'um4-outsider@example.com', name: 'UM4 Outsider' },
}

const cookies: Record<string, string> = {}
const userIds: Record<string, string> = {}
let campaignId = ''

const loginAndGetCookie = async (email: string) => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  expect(response.status).toBe(200)
  return response.headers.get('set-cookie') || ''
}

describe('user management UM-4 membership and invite flows', () => {
  beforeAll(async () => {
    db.prepare({ migrate: true, seed: false, stdio: 'pipe' })

    const server = await startManagedNuxtDevServer({
      rootDir,
      port: 4177,
      env,
    })

    baseUrl = server.baseUrl
    stopServer = server.stop

    const passwordHash = await hash.make(password)

    for (const [key, user] of Object.entries(users)) {
      const created = await prisma.user.create({
        data: {
          email: user.email,
          name: user.name,
          passwordHash,
        },
        select: { id: true },
      })
      userIds[key] = created.id
    }

    const campaign = await prisma.campaign.create({
      data: {
        ownerId: userIds.owner,
        name: 'UM4 Membership Campaign',
        members: {
          create: [
            {
              userId: userIds.owner,
              role: 'OWNER',
              invitedByUserId: userIds.owner,
            },
            {
              userId: userIds.collaborator,
              role: 'COLLABORATOR',
              invitedByUserId: userIds.owner,
            },
          ],
        },
      },
      select: { id: true },
    })

    campaignId = campaign.id

    for (const [key, value] of Object.entries(users)) {
      cookies[key] = await loginAndGetCookie(value.email)
    }
  }, 120_000)

  afterAll(async () => {
    await stopServer()
    await prisma.$disconnect()
    await db.cleanup()
  })

  it('allows owner to list members and denies collaborator membership management', async () => {
    const ownerRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/members`, {
      headers: { cookie: cookies.owner },
    })

    expect(ownerRes.status).toBe(200)
    const ownerPayload = await ownerRes.json()
    expect(ownerPayload.data.members.length).toBeGreaterThanOrEqual(2)

    const collaboratorRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/members`, {
      headers: { cookie: cookies.collaborator },
    })

    expect(collaboratorRes.status).toBe(403)
    const collaboratorPayload = await collaboratorRes.json()
    expect(collaboratorPayload.error.code).toBe('FORBIDDEN')
  })

  it('creates invite and prevents replay after acceptance', async () => {
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

    const acceptRes = await fetch(`${baseUrl}/api/campaign-invites/${inviteToken}/accept`, {
      method: 'POST',
      headers: {
        cookie: cookies.invitee,
      },
    })

    expect(acceptRes.status).toBe(200)
    const acceptPayload = await acceptRes.json()
    expect(acceptPayload.data.campaignId).toBe(campaignId)
    expect(acceptPayload.data.role).toBe('VIEWER')

    const replayRes = await fetch(`${baseUrl}/api/campaign-invites/${inviteToken}/accept`, {
      method: 'POST',
      headers: {
        cookie: cookies.invitee,
      },
    })

    expect(replayRes.status).toBe(200)
    const replayPayload = await replayRes.json()
    expect(replayPayload.data.campaignId).toBe(campaignId)
    expect(replayPayload.data.role).toBe('VIEWER')
  })

  it('rejects expired invite acceptance and marks invite expired', async () => {
    const expiredToken = 'expired-invite-token-um4'
    const tokenHash = createHash('sha256').update(expiredToken).digest('hex')

    const expiredInvite = await prisma.campaignInvite.create({
      data: {
        campaignId,
        email: users.outsider.email,
        role: 'VIEWER',
        tokenHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 60_000),
        invitedByUserId: userIds.owner,
      },
      select: { id: true },
    })

    const acceptRes = await fetch(`${baseUrl}/api/campaign-invites/${expiredToken}/accept`, {
      method: 'POST',
      headers: {
        cookie: cookies.outsider,
      },
    })

    expect(acceptRes.status).toBe(410)
    const payload = await acceptRes.json()
    expect(payload.error.code).toBe('INVITE_EXPIRED')

    const invite = await prisma.campaignInvite.findUnique({
      where: { id: expiredInvite.id },
      select: { status: true },
    })

    expect(invite?.status).toBe('EXPIRED')
  })

  it('inspects invite state for already-member, wrong-account, missing, and expired cases', async () => {
    const viewerInviteToken = 'inspect-viewer-token-um4'
    const viewerInviteHash = createHash('sha256').update(viewerInviteToken).digest('hex')

    await prisma.campaignInvite.create({
      data: {
        campaignId,
        email: users.outsider.email,
        role: 'VIEWER',
        tokenHash: viewerInviteHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        invitedByUserId: userIds.invitee,
      },
    })

    const alreadyMemberInspect = await fetch(`${baseUrl}/api/campaign-invites/${viewerInviteToken}`, {
      headers: { cookie: cookies.invitee },
    })

    expect(alreadyMemberInspect.status).toBe(200)
    const alreadyMemberPayload = await alreadyMemberInspect.json()
    expect(alreadyMemberPayload.data.status).toBe('ALREADY_MEMBER')
    expect(alreadyMemberPayload.data.campaignId).toBe(campaignId)

    const wrongAccountToken = 'inspect-wrong-account-token-um4'
    const wrongAccountHash = createHash('sha256').update(wrongAccountToken).digest('hex')

    await prisma.campaignInvite.create({
      data: {
        campaignId,
        email: 'um4-different-user@example.com',
        role: 'VIEWER',
        tokenHash: wrongAccountHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        invitedByUserId: userIds.invitee,
      },
    })

    const wrongAccountInspect = await fetch(`${baseUrl}/api/campaign-invites/${wrongAccountToken}`, {
      headers: { cookie: cookies.outsider },
    })
    expect(wrongAccountInspect.status).toBe(200)
    const wrongAccountPayload = await wrongAccountInspect.json()
    expect(wrongAccountPayload.data.status).toBe('WRONG_ACCOUNT')
    expect(wrongAccountPayload.data.campaignId).toBeUndefined()

    const notFoundInspect = await fetch(`${baseUrl}/api/campaign-invites/does-not-exist-token-um4`, {
      headers: { cookie: cookies.owner },
    })
    expect(notFoundInspect.status).toBe(200)
    const notFoundPayload = await notFoundInspect.json()
    expect(notFoundPayload.data.status).toBe('INVITE_NOT_FOUND')

    const expiredInspectToken = 'inspect-expired-token-um4'
    const expiredInspectHash = createHash('sha256').update(expiredInspectToken).digest('hex')

    const expiredInvite = await prisma.campaignInvite.create({
      data: {
        campaignId,
        email: users.outsider.email,
        role: 'VIEWER',
        tokenHash: expiredInspectHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 60_000),
        invitedByUserId: userIds.invitee,
      },
      select: { id: true },
    })

    const expiredInspect = await fetch(`${baseUrl}/api/campaign-invites/${expiredInspectToken}`, {
      headers: { cookie: cookies.outsider },
    })
    expect(expiredInspect.status).toBe(200)
    const expiredInspectPayload = await expiredInspect.json()
    expect(expiredInspectPayload.data.status).toBe('INVITE_EXPIRED')

    const expiredInviteStatus = await prisma.campaignInvite.findUnique({
      where: { id: expiredInvite.id },
      select: { status: true },
    })
    expect(expiredInviteStatus?.status).toBe('EXPIRED')
  })

  it('supports role update/remove and enforces owner transfer re-auth', async () => {
    const collaboratorMember = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId,
          userId: userIds.collaborator,
        },
      },
      select: { id: true },
    })

    expect(collaboratorMember?.id).toBeTruthy()

    const updateRoleRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/members/${collaboratorMember?.id}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ role: 'VIEWER' }),
    })

    expect(updateRoleRes.status).toBe(200)

    const deleteRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/members/${collaboratorMember?.id}`, {
      method: 'DELETE',
      headers: {
        cookie: cookies.owner,
      },
    })

    expect(deleteRes.status).toBe(200)

    const inviteeMember = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId,
          userId: userIds.invitee,
        },
      },
      select: { id: true },
    })

    expect(inviteeMember?.id).toBeTruthy()

    const badTransferRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/owner-transfer`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        targetMemberId: inviteeMember?.id,
        password: 'wrong-password',
      }),
    })

    expect(badTransferRes.status).toBe(401)

    const transferRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/owner-transfer`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        targetMemberId: inviteeMember?.id,
        password,
      }),
    })

    expect(transferRes.status).toBe(200)

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { ownerId: true },
    })

    expect(campaign?.ownerId).toBe(userIds.invitee)

    const ownerMember = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId,
          userId: userIds.owner,
        },
      },
      select: { role: true },
    })

    const inviteeOwnerMember = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId,
          userId: userIds.invitee,
        },
      },
      select: { role: true },
    })

    expect(ownerMember?.role).toBe('COLLABORATOR')
    expect(inviteeOwnerMember?.role).toBe('OWNER')

    const oldOwnerManageRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/members`, {
      headers: { cookie: cookies.owner },
    })

    expect(oldOwnerManageRes.status).toBe(403)
  })
})
