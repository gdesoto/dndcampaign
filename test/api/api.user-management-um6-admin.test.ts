// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const prisma = createApiTestPrismaClient()
const hash = new Hash(new Scrypt())

const password = 'um6-admin-password-12345'
const baseUrl = getApiTestBaseUrl()
const authHeaders = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.16',
}

const users = {
  admin: { email: 'um6-admin@example.com', name: 'UM6 Admin', systemRole: 'SYSTEM_ADMIN' as const },
  ownerA: { email: 'um6-owner-a@example.com', name: 'Owner A', systemRole: 'USER' as const },
  ownerB: { email: 'um6-owner-b@example.com', name: 'Owner B', systemRole: 'USER' as const },
  normal: { email: 'um6-normal@example.com', name: 'Normal User', systemRole: 'USER' as const },
}

const cookies: Record<string, string> = {}
const userIds: Record<string, string> = {}
let campaignId = ''

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

describe('user management UM-6 admin and analytics flows', () => {
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
        ownerId: userIds.ownerA,
        name: 'UM6 Admin Campaign',
        members: {
          create: [
            {
              userId: userIds.ownerA,
              role: 'OWNER',
              invitedByUserId: userIds.ownerA,
            },
          ],
        },
      },
      select: { id: true },
    })

    campaignId = campaign.id

    const session = await prisma.session.create({
      data: {
        campaignId,
        title: 'UM6 Session',
      },
      select: { id: true },
    })

    const artifact = await prisma.artifact.create({
      data: {
        ownerId: userIds.ownerA,
        campaignId,
        provider: 'LOCAL',
        storageKey: `um6/${campaignId}/rec.mp3`,
        mimeType: 'audio/mpeg',
        byteSize: 1024,
      },
      select: { id: true },
    })

    const recording = await prisma.recording.create({
      data: {
        sessionId: session.id,
        kind: 'AUDIO',
        filename: 'recording.mp3',
        mimeType: 'audio/mpeg',
        byteSize: 1024,
        artifactId: artifact.id,
      },
      select: { id: true },
    })

    await prisma.transcriptionJob.create({
      data: {
        recordingId: recording.id,
        provider: 'ELEVENLABS',
        status: 'COMPLETED',
      },
    })

    await prisma.transcriptionJob.create({
      data: {
        recordingId: recording.id,
        provider: 'ELEVENLABS',
        status: 'FAILED',
      },
    })

    const document = await prisma.document.create({
      data: {
        campaignId,
        sessionId: session.id,
        type: 'TRANSCRIPT',
        title: 'UM6 Transcript',
      },
      select: { id: true },
    })

    const docVersion = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: 1,
        content: 'seed transcript',
      },
      select: { id: true },
    })

    await prisma.document.update({
      where: { id: document.id },
      data: {
        currentVersionId: docVersion.id,
      },
    })

    await prisma.summaryJob.create({
      data: {
        campaignId,
        sessionId: session.id,
        documentId: document.id,
        trackingId: `um6-summary-${campaignId}-1`,
        status: 'READY_FOR_REVIEW',
        mode: 'SYNC',
      },
    })

    await prisma.summaryJob.create({
      data: {
        campaignId,
        sessionId: session.id,
        documentId: document.id,
        trackingId: `um6-summary-${campaignId}-2`,
        status: 'FAILED',
        mode: 'SYNC',
      },
    })

    for (const [key, value] of Object.entries(users)) {
      cookies[key] = await loginAndGetCookie(value.email)
    }
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('enforces system admin guard for admin endpoints', async () => {
    const denied = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { cookie: cookies.normal },
    })

    expect(denied.status).toBe(403)

    const allowed = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { cookie: cookies.admin },
    })

    expect(allowed.status).toBe(200)
    const payload = await allowed.json()
    expect(payload.data.users.length).toBeGreaterThan(0)
  })

  it('supports admin user management and writes audit records', async () => {
    const updateRes = await fetch(`${baseUrl}/api/admin/users/${userIds.normal}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.admin,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        isActive: false,
        systemRole: 'SYSTEM_ADMIN',
      }),
    })

    expect(updateRes.status).toBe(200)

    const user = await prisma.user.findUnique({
      where: { id: userIds.normal },
      select: { isActive: true, systemRole: true },
    })

    expect(user?.isActive).toBe(false)
    expect(user?.systemRole).toBe('SYSTEM_ADMIN')

    const audits = await prisma.adminAuditLog.findMany({
      where: {
        targetType: 'USER',
        targetId: userIds.normal,
      },
    })

    expect(audits.length).toBeGreaterThan(0)
  })

  it('supports campaign archive + owner transfer via admin endpoint', async () => {
    const archiveRes = await fetch(`${baseUrl}/api/admin/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.admin,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ isArchived: true }),
    })

    expect(archiveRes.status).toBe(200)

    const transferRes = await fetch(`${baseUrl}/api/admin/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.admin,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ transferOwnerUserId: userIds.ownerB }),
    })

    expect(transferRes.status).toBe(200)

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { ownerId: true, isArchived: true },
    })

    expect(campaign?.ownerId).toBe(userIds.ownerB)
    expect(campaign?.isArchived).toBe(true)

    const audits = await prisma.adminAuditLog.findMany({
      where: {
        targetType: 'CAMPAIGN',
        targetId: campaignId,
      },
    })

    expect(audits.length).toBeGreaterThan(0)
  })

  it('returns analytics overview/usage/jobs and csv exports', async () => {
    const overviewRes = await fetch(`${baseUrl}/api/admin/analytics/overview`, {
      headers: { cookie: cookies.admin },
    })
    expect(overviewRes.status).toBe(200)

    const usageRes = await fetch(`${baseUrl}/api/admin/analytics/usage`, {
      headers: { cookie: cookies.admin },
    })
    expect(usageRes.status).toBe(200)

    const jobsRes = await fetch(`${baseUrl}/api/admin/analytics/jobs`, {
      headers: { cookie: cookies.admin },
    })
    expect(jobsRes.status).toBe(200)

    const usageCsvRes = await fetch(`${baseUrl}/api/admin/analytics/usage.csv`, {
      headers: { cookie: cookies.admin },
    })
    expect(usageCsvRes.status).toBe(200)
    expect(usageCsvRes.headers.get('content-type') || '').toContain('text/csv')
    const usageCsv = await usageCsvRes.text()
    expect(usageCsv).toContain('campaign_id')

    const jobsCsvRes = await fetch(`${baseUrl}/api/admin/analytics/jobs.csv`, {
      headers: { cookie: cookies.admin },
    })
    expect(jobsCsvRes.status).toBe(200)
    expect(jobsCsvRes.headers.get('content-type') || '').toContain('text/csv')
    const jobsCsv = await jobsCsvRes.text()
    expect(jobsCsv).toContain('transcription_completed')
  })
})







