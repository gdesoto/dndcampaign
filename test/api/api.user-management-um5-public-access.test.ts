// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const prisma = createApiTestPrismaClient()
const hash = new Hash(new Scrypt())

const password = 'um5-owner-password-12345'
const baseUrl = getApiTestBaseUrl()
const authHeaders = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.15',
}

const users = {
  owner: { email: 'um5-owner@example.com', name: 'UM5 Owner' },
  collaborator: { email: 'um5-collaborator@example.com', name: 'UM5 Collaborator' },
}

const cookies: Record<string, string> = {}
const userIds: Record<string, string> = {}
let campaignId = ''
let recapId = ''
let mapSlug = ''

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

describe('user management UM-5 public visibility', () => {
  beforeAll(async () => {
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
        name: 'UM5 Public Campaign',
        system: 'D&D 5e',
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

    await prisma.session.create({
      select: { id: true },
      data: {
        campaignId,
        title: 'Session One',
        sessionNumber: 1,
        notes: 'Public notes',
      },
    })
      .then(async (session) => {
        const artifact = await prisma.artifact.create({
          data: {
            ownerId: userIds.owner,
            campaignId,
            provider: 'LOCAL',
            storageKey: `um5-test-recap-${session.id}.mp3`,
            mimeType: 'audio/mpeg',
            byteSize: 128,
          },
          select: { id: true },
        })
        const recap = await prisma.recapRecording.create({
          data: {
            sessionId: session.id,
            filename: 'session-one.mp3',
            mimeType: 'audio/mpeg',
            byteSize: 128,
            artifactId: artifact.id,
          },
          select: { id: true },
        })
        recapId = recap.id
      })

    await prisma.glossaryEntry.create({
      data: {
        campaignId,
        type: 'NPC',
        name: 'Elandra',
        description: 'Archivist of the Dawn Library.',
      },
    })

    await prisma.quest.create({
      data: {
        campaignId,
        title: 'Secret Quest',
        status: 'ACTIVE',
      },
    })

    const map = await prisma.campaignMap.create({
      data: {
        campaignId,
        name: 'Public Region',
        slug: 'public-region',
        isPrimary: true,
        createdById: userIds.owner,
        sourceFingerprint: 'um5-map-fingerprint',
        rawManifestJson: {
          bounds: [[-20, -20], [20, 20]],
        },
      },
      select: { id: true, slug: true },
    })
    mapSlug = map.slug

    await prisma.campaignMapFeature.create({
      data: {
        campaignMapId: map.id,
        externalId: 'state-1',
        featureType: 'STATE',
        name: 'Public State',
        displayName: 'Public State',
        normalizedName: 'public state',
        geometryType: 'Polygon',
        geometryJson: {
          type: 'Polygon',
          coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]],
        },
        sourceRef: 'state:1',
      },
    })

    for (const [key, value] of Object.entries(users)) {
      cookies[key] = await loginAndGetCookie(value.email)
    }
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('enforces owner-only management and anonymous section visibility', async () => {
    const ownerGetRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access`, {
      headers: { cookie: cookies.owner },
    })
    expect(ownerGetRes.status).toBe(200)
    const ownerGetPayload = await ownerGetRes.json()
    expect(ownerGetPayload.data.isEnabled).toBe(false)
    expect(ownerGetPayload.data.publicSlug).toBeTruthy()

    const collaboratorGetRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access`, {
      headers: { cookie: cookies.collaborator },
    })
    expect(collaboratorGetRes.status).toBe(403)

    const patchRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        isEnabled: true,
        showSessions: true,
        showGlossary: true,
        showQuests: false,
      }),
    })
    expect(patchRes.status).toBe(200)
    const patchPayload = await patchRes.json()
    const publicSlug = patchPayload.data.publicSlug as string
    expect(patchPayload.data.isEnabled).toBe(true)
    expect(patchPayload.data.isListed).toBe(false)
    expect(patchPayload.data.showSessions).toBe(true)
    expect(patchPayload.data.showGlossary).toBe(true)
    expect(patchPayload.data.showQuests).toBe(false)

    const overviewRes = await fetch(`${baseUrl}/api/public/campaigns/${publicSlug}`)
    expect(overviewRes.status).toBe(200)
    const overviewPayload = await overviewRes.json()
    expect(overviewPayload.data.sections.showSessions).toBe(true)
    expect(overviewPayload.data.sections.showGlossary).toBe(true)
    expect(overviewPayload.data.sections.showQuests).toBe(false)

    const sessionsRes = await fetch(`${baseUrl}/api/public/campaigns/${publicSlug}/sessions`)
    expect(sessionsRes.status).toBe(200)
    const sessionsPayload = await sessionsRes.json()
    expect(sessionsPayload.data.length).toBe(1)

    const glossaryRes = await fetch(`${baseUrl}/api/public/campaigns/${publicSlug}/glossary`)
    expect(glossaryRes.status).toBe(200)
    const glossaryPayload = await glossaryRes.json()
    expect(glossaryPayload.data.length).toBe(1)

    const questsRes = await fetch(`${baseUrl}/api/public/campaigns/${publicSlug}/quests`)
    expect(questsRes.status).toBe(404)
    const questsPayload = await questsRes.json()
    expect(questsPayload.error.code).toBe('PUBLIC_SECTION_NOT_AVAILABLE')
  })

  it('supports optional public directory listing and public discovery endpoints', async () => {
    const notListedRes = await fetch(`${baseUrl}/api/public/campaigns`)
    expect(notListedRes.status).toBe(200)
    const notListedPayload = await notListedRes.json()
    const beforeListed = (notListedPayload.data as Array<{ publicSlug: string }>).some(
      (entry) => entry.publicSlug
    )
    expect(beforeListed).toBe(false)

    const enableListingRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        isEnabled: true,
        isListed: true,
      }),
    })
    expect(enableListingRes.status).toBe(200)
    const listingPayload = await enableListingRes.json()
    const publicSlug = listingPayload.data.publicSlug as string
    expect(listingPayload.data.isListed).toBe(true)

    const listedRes = await fetch(`${baseUrl}/api/public/campaigns?search=UM5`)
    expect(listedRes.status).toBe(200)
    const listedPayload = await listedRes.json()
    const listedItems = listedPayload.data as Array<{ publicSlug: string }>
    expect(listedItems.some((entry) => entry.publicSlug === publicSlug)).toBe(true)

    const sampleRes = await fetch(`${baseUrl}/api/public/campaigns?random=1&limit=3`)
    expect(sampleRes.status).toBe(200)
    const samplePayload = await sampleRes.json()
    expect(Array.isArray(samplePayload.data)).toBe(true)
  })

  it('allows public recap playback-url and public map viewer access', async () => {
    const settingsRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access`, {
      headers: { cookie: cookies.owner },
    })
    expect(settingsRes.status).toBe(200)
    const settingsPayload = await settingsRes.json()
    const publicSlug = settingsPayload.data.publicSlug as string

    const enableSectionsRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        isEnabled: true,
        showRecaps: true,
        showMaps: true,
      }),
    })
    expect(enableSectionsRes.status).toBe(200)

    const recapPlaybackRes = await fetch(
      `${baseUrl}/api/public/campaigns/${publicSlug}/recaps/${recapId}/playback-url`
    )
    expect(recapPlaybackRes.status).toBe(200)
    const recapPlaybackPayload = await recapPlaybackRes.json()
    expect(recapPlaybackPayload.data.url).toContain(`/api/public/campaigns/${publicSlug}/recaps/${recapId}/stream`)

    const viewerRes = await fetch(
      `${baseUrl}/api/public/campaigns/${publicSlug}/maps/${mapSlug}/viewer`
    )
    expect(viewerRes.status).toBe(200)
    const viewerPayload = await viewerRes.json()
    expect(Array.isArray(viewerPayload.data.features)).toBe(true)
    expect(viewerPayload.data.features.length).toBeGreaterThan(0)
  })

  it('regenerates slug and invalidates old URL', async () => {
    const beforeRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access`, {
      headers: { cookie: cookies.owner },
    })
    expect(beforeRes.status).toBe(200)
    const beforePayload = await beforeRes.json()
    const oldSlug = beforePayload.data.publicSlug as string

    const regenRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access/regenerate-slug`, {
      method: 'POST',
      headers: { cookie: cookies.owner },
    })
    expect(regenRes.status).toBe(200)
    const regenPayload = await regenRes.json()
    const newSlug = regenPayload.data.publicSlug as string
    expect(newSlug).not.toBe(oldSlug)

    const oldOverview = await fetch(`${baseUrl}/api/public/campaigns/${oldSlug}`)
    expect(oldOverview.status).toBe(404)

    const newOverview = await fetch(`${baseUrl}/api/public/campaigns/${newSlug}`)
    expect(newOverview.status).toBe(200)
  })

  it('denies anonymous access when public access is disabled', async () => {
    const currentRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access`, {
      headers: { cookie: cookies.owner },
    })
    expect(currentRes.status).toBe(200)
    const currentPayload = await currentRes.json()
    const slug = currentPayload.data.publicSlug as string

    const disableRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        isEnabled: false,
      }),
    })
    expect(disableRes.status).toBe(200)

    const overviewRes = await fetch(`${baseUrl}/api/public/campaigns/${slug}`)
    expect(overviewRes.status).toBe(404)
    const overviewPayload = await overviewRes.json()
    expect(overviewPayload.error.code).toBe('PUBLIC_CAMPAIGN_NOT_FOUND')
  })
})







