// @vitest-environment node
import { and, eq } from 'drizzle-orm'
import * as schema from '../../server/db/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestDatabase } from '../scripts/db-test-client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const db = createApiTestDatabase()
const hash = new Hash(new Scrypt({}))

const password = 'admin-admin-password-12345'
const baseUrl = getApiTestBaseUrl()
const authHeaders = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.16',
}

const users = {
  admin: { email: 'admin-admin@example.com', name: 'Admin Admin', systemRole: 'SYSTEM_ADMIN' as const },
  ownerA: { email: 'admin-owner-a@example.com', name: 'Owner A', systemRole: 'USER' as const },
  ownerB: { email: 'admin-owner-b@example.com', name: 'Owner B', systemRole: 'USER' as const },
  normal: { email: 'admin-normal@example.com', name: 'Normal User', systemRole: 'USER' as const },
}

const cookies: Record<string, string> = {}
const userIds: Record<string, string> = {}
let campaignId = ''
let referencedArtifactId = ''
let nonemptyDocumentId = ''

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

describe('administration, audit and analytics', () => {
  beforeAll(async () => {
    const passwordHash = await hash.make(password)

    for (const [key, user] of Object.entries(users)) {
      const created = db.insert(schema.user).values({
          email: user.email,
          name: user.name,
          passwordHash,
          systemRole: user.systemRole,
          lastLoginAt: new Date(),
        }).returning({ id: schema.user.id }).get()!
      userIds[key] = created.id
    }

    const campaign = db.insert(schema.campaign).values({
        ownerId: userIds.ownerA,
        name: 'Admin Admin Campaign',
      }).returning({ id: schema.campaign.id }).get()!

    db.insert(schema.campaignMember).values({ campaignId: campaign.id, userId: userIds.ownerA, role: 'OWNER', invitedByUserId: userIds.ownerA }).run()

    campaignId = campaign.id

    const session = db.insert(schema.session).values({
        campaignId,
        title: 'Admin Session',
      }).returning({ id: schema.session.id }).get()!

    const artifact = db.insert(schema.artifact).values({
        ownerId: userIds.ownerA,
        campaignId,
        provider: 'LOCAL',
        storageKey: `admin/${campaignId}/rec.mp3`,
        mimeType: 'audio/mpeg',
        byteSize: 1024,
      }).returning({ id: schema.artifact.id }).get()!

    referencedArtifactId = artifact.id

    const recording = db.insert(schema.recording).values({
        sessionId: session.id,
        kind: 'AUDIO',
        filename: 'recording.mp3',
        mimeType: 'audio/mpeg',
        byteSize: 1024,
        artifactId: artifact.id,
      }).returning({ id: schema.recording.id }).get()!

    db.insert(schema.transcriptionJob).values({
        recordingId: recording.id,
        provider: 'ELEVENLABS',
        status: 'COMPLETED',
      }).returning().get()!

    db.insert(schema.transcriptionJob).values({
        recordingId: recording.id,
        provider: 'ELEVENLABS',
        status: 'FAILED',
      }).returning().get()!

    const document = db.insert(schema.document).values({
        campaignId,
        sessionId: session.id,
        type: 'TRANSCRIPT',
        title: 'Admin Transcript',
      }).returning({ id: schema.document.id }).get()!

    nonemptyDocumentId = document.id

    const docVersion = db.insert(schema.documentVersion).values({
        documentId: document.id,
        versionNumber: 1,
        content: 'seed transcript',
      }).returning({ id: schema.documentVersion.id }).get()!

    db.update(schema.document).set({
        currentVersionId: docVersion.id,
      }).where(eq(schema.document.id, document.id)).returning().get()!

    db.insert(schema.summaryJob).values({
        campaignId,
        sessionId: session.id,
        documentId: document.id,
        trackingId: `admin-summary-${campaignId}-1`,
        status: 'READY_FOR_REVIEW',
        mode: 'SYNC',
      }).returning().get()!

    db.insert(schema.summaryJob).values({
        campaignId,
        sessionId: session.id,
        documentId: document.id,
        trackingId: `admin-summary-${campaignId}-2`,
        status: 'FAILED',
        mode: 'SYNC',
      }).returning().get()!

    for (const [key, value] of Object.entries(users)) {
      cookies[key] = await loginAndGetCookie(value.email)
    }
  }, 120_000)

  afterAll(async () => {
    db.$client.close()
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

    const user = db.select({ isActive: schema.user.isActive, systemRole: schema.user.systemRole }).from(schema.user).where(eq(schema.user.id, userIds.normal)).get()

    expect(user?.isActive).toBe(false)
    expect(user?.systemRole).toBe('SYSTEM_ADMIN')

    const audits = db.select().from(schema.adminAuditLog).where(and(eq(schema.adminAuditLog.targetType, 'USER'), eq(schema.adminAuditLog.targetId, userIds.normal))).all()

    expect(audits.length).toBeGreaterThan(0)

    expect(db.select().from(schema.activityLog).where(and(eq(schema.activityLog.actorUserId, userIds.admin), eq(schema.activityLog.targetId, userIds.normal), eq(schema.activityLog.action, 'ADMIN_USER_UPDATE'))).get() ?? null).not.toBeNull()

    const deniedActivity = await fetch(`${baseUrl}/api/admin/activity`, { headers: { cookie: cookies.ownerA } })
    expect(deniedActivity.status).toBe(403)
    const activity = await fetch(`${baseUrl}/api/admin/activity?scope=ADMIN&search=ADMIN_USER_UPDATE&pageSize=100`, {
      headers: { cookie: cookies.admin },
    })
    expect(activity.status).toBe(200)
    const logs = (await activity.json()).data.logs
    expect(logs.length).toBeGreaterThan(0)
    expect(logs.every((entry: { scope: string; action: string }) => entry.scope === 'ADMIN' && entry.action === 'ADMIN_USER_UPDATE')).toBe(true)
    expect(logs).toEqual(expect.arrayContaining([
      expect.objectContaining({ actorUserId: userIds.admin, targetId: userIds.normal, action: 'ADMIN_USER_UPDATE' }),
    ]))
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

    const campaign = db.select({ ownerId: schema.campaign.ownerId, isArchived: schema.campaign.isArchived }).from(schema.campaign).where(eq(schema.campaign.id, campaignId)).get()

    expect(campaign?.ownerId).toBe(userIds.ownerB)
    expect(campaign?.isArchived).toBe(true)

    const campaignDetailRes = await fetch(`${baseUrl}/api/admin/campaigns/${campaignId}`, {
      headers: { cookie: cookies.admin },
    })
    expect(campaignDetailRes.status).toBe(200)
    expect((await campaignDetailRes.json()).data.counts).toEqual({
      members: 2, sessions: 1, glossary: 0, quests: 0, milestones: 0, recordings: 1, documents: 1,
    })

    const ownerDetailRes = await fetch(`${baseUrl}/api/admin/users/${userIds.ownerB}`, {
      headers: { cookie: cookies.admin },
    })
    expect(ownerDetailRes.status).toBe(200)
    expect((await ownerDetailRes.json()).data).toMatchObject({ ownedCampaignCount: 1, memberCampaignCount: 1 })

    const ownersRes = await fetch(`${baseUrl}/api/admin/users?search=${encodeURIComponent(users.ownerB.email)}`, {
      headers: { cookie: cookies.admin },
    })
    expect(ownersRes.status).toBe(200)
    const owners = (await ownersRes.json()).data
    expect(owners.total).toBe(1)
    expect(owners.users).toEqual([expect.objectContaining({ id: userIds.ownerB, ownedCampaignCount: 1, memberCampaignCount: 1 })])

    const campaignsRes = await fetch(`${baseUrl}/api/admin/campaigns?search=Admin%20Admin%20Campaign`, {
      headers: { cookie: cookies.admin },
    })
    expect(campaignsRes.status).toBe(200)
    const campaigns = (await campaignsRes.json()).data
    expect(campaigns.total).toBe(1)
    expect(campaigns.campaigns).toEqual([expect.objectContaining({ id: campaignId, memberCount: 2, sessionCount: 1, documentCount: 1 })])

    const audits = db.select().from(schema.adminAuditLog).where(and(eq(schema.adminAuditLog.targetType, 'CAMPAIGN'), eq(schema.adminAuditLog.targetId, campaignId))).all()

    expect(audits.length).toBeGreaterThan(0)
  })

  it('counts storage references and document versions before allowing cleanup', async () => {
    const auditRes = await fetch(`${baseUrl}/api/admin/storage-audit?campaignId=${campaignId}&issuesOnly=false`, {
      headers: { cookie: cookies.admin },
    })
    expect(auditRes.status).toBe(200)
    const audit = (await auditRes.json()).data
    expect(audit.artifactRows).toEqual([expect.objectContaining({
      artifactId: referencedArtifactId, referencedCount: 1, fixActions: [],
    })])
    expect(audit.documentRows).toEqual([expect.objectContaining({
      documentId: nonemptyDocumentId, versionCount: 1, status: 'OK', fixActions: [],
    })])

    for (const [input, code] of [
      [{ action: 'DELETE_UNREFERENCED_ARTIFACT', artifactId: referencedArtifactId }, 'ARTIFACT_REFERENCED'],
      [{ action: 'DELETE_EMPTY_DOCUMENT', documentId: nonemptyDocumentId }, 'DOCUMENT_NOT_EMPTY'],
    ] as const) {
      const cleanupRes = await fetch(`${baseUrl}/api/admin/storage-audit/fix`, {
        method: 'POST',
        headers: { cookie: cookies.admin, 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      expect(cleanupRes.status).toBe(409)
      expect((await cleanupRes.json()).error.code).toBe(code)
    }
    expect(db.select({ id: schema.artifact.id }).from(schema.artifact).where(eq(schema.artifact.id, referencedArtifactId)).get()).toBeDefined()
    expect(db.select({ id: schema.document.id }).from(schema.document).where(eq(schema.document.id, nonemptyDocumentId)).get()).toBeDefined()
    expect(db.select({ id: schema.documentVersion.id }).from(schema.documentVersion).where(eq(schema.documentVersion.documentId, nonemptyDocumentId)).all()).toHaveLength(1)
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
    const usage = (await usageRes.json()).data
    expect(usage.campaignUsage).toEqual(expect.arrayContaining([
      expect.objectContaining({ campaignId, memberCount: 2, sessionCount: 1, artifactCount: 1, storageBytes: 1024 }),
    ]))

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
