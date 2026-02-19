// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { getApiTestBaseUrl, getApiTestDatabaseUrl } from '../scripts/api-test-context.mjs'

const prisma = new PrismaClient({ datasourceUrl: getApiTestDatabaseUrl() })
const hash = new Hash(new Scrypt())

const password = 'strongpass12345'
const baseUrl = getApiTestBaseUrl()
const authHeaders = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.13',
}

const users = {
  owner: { email: 'um3-owner@example.com', name: 'UM3 Owner' },
  collaborator: { email: 'um3-collab@example.com', name: 'UM3 Collaborator' },
  viewer: { email: 'um3-viewer@example.com', name: 'UM3 Viewer' },
  outsider: { email: 'um3-outsider@example.com', name: 'UM3 Outsider' },
}

const cookies: Record<string, string> = {}
let campaignId = ''
let mapId = ''
let sharedCharacterId = ''

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

describe('user management UM-3 RBAC', () => {
  beforeAll(async () => {
    const passwordHash = await hash.make(password)

    const createdUsers = await Promise.all(
      Object.values(users).map((user) =>
        prisma.user.create({
          data: {
            email: user.email,
            name: user.name,
            passwordHash,
          },
          select: { id: true, email: true },
        })
      )
    )

    const ownerId = createdUsers.find((user) => user.email === users.owner.email)?.id as string
    const collaboratorId = createdUsers.find((user) => user.email === users.collaborator.email)?.id as string
    const viewerId = createdUsers.find((user) => user.email === users.viewer.email)?.id as string

    const campaign = await prisma.campaign.create({
      data: {
        ownerId,
        name: 'UM3 RBAC Campaign',
        members: {
          create: [
            {
              userId: ownerId,
              role: 'OWNER',
              invitedByUserId: ownerId,
            },
            {
              userId: collaboratorId,
              role: 'COLLABORATOR',
              invitedByUserId: ownerId,
            },
            {
              userId: viewerId,
              role: 'VIEWER',
              invitedByUserId: ownerId,
            },
          ],
        },
      },
      select: { id: true },
    })
    campaignId = campaign.id

    const map = await prisma.campaignMap.create({
      data: {
        campaignId,
        name: 'Shared Map',
        slug: 'shared-map',
        createdById: ownerId,
        sourceFingerprint: 'um3-test-map-fingerprint',
      },
      select: { id: true },
    })
    mapId = map.id

    const character = await prisma.playerCharacter.create({
      data: {
        ownerId,
        name: 'Shared Character',
        sheetJson: { basics: { name: 'Shared Character' } },
        summaryJson: { name: 'Shared Character', level: 3 },
      },
      select: { id: true },
    })
    sharedCharacterId = character.id

    await prisma.campaignCharacter.create({
      data: {
        campaignId,
        characterId: character.id,
      },
    })

    for (const [key, value] of Object.entries(users)) {
      cookies[key] = await loginAndGetCookie(value.email)
    }
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('allows collaborator and viewer to see shared campaign in list', async () => {
    const collaboratorRes = await fetch(`${baseUrl}/api/campaigns`, {
      headers: { cookie: cookies.collaborator },
    })
    expect(collaboratorRes.status).toBe(200)
    const collaboratorPayload = await collaboratorRes.json()
    expect(collaboratorPayload.data.some((campaign: { id: string }) => campaign.id === campaignId)).toBe(true)

    const viewerRes = await fetch(`${baseUrl}/api/campaigns`, {
      headers: { cookie: cookies.viewer },
    })
    expect(viewerRes.status).toBe(200)
    const viewerPayload = await viewerRes.json()
    expect(viewerPayload.data.some((campaign: { id: string }) => campaign.id === campaignId)).toBe(true)
  })

  it('allows collaborator writes but denies viewer writes with 403', async () => {
    const collaboratorCreate = await fetch(`${baseUrl}/api/campaigns/${campaignId}/sessions`, {
      method: 'POST',
      headers: {
        cookie: cookies.collaborator,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: 'Collaborator Session' }),
    })
    expect(collaboratorCreate.status).toBe(200)

    const viewerCreate = await fetch(`${baseUrl}/api/campaigns/${campaignId}/sessions`, {
      method: 'POST',
      headers: {
        cookie: cookies.viewer,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: 'Viewer Session Attempt' }),
    })
    expect(viewerCreate.status).toBe(403)
    const viewerPayload = await viewerCreate.json()
    expect(viewerPayload.error.code).toBe('FORBIDDEN')
  })

  it('denies collaborator campaign settings update and non-member campaign read', async () => {
    const collaboratorPatch = await fetch(`${baseUrl}/api/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.collaborator,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Collaborator should not rename' }),
    })
    expect(collaboratorPatch.status).toBe(403)

    const outsiderGet = await fetch(`${baseUrl}/api/campaigns/${campaignId}`, {
      headers: { cookie: cookies.outsider },
    })
    expect(outsiderGet.status).toBe(403)
  })

  it('enforces map read/write by role', async () => {
    const viewerList = await fetch(`${baseUrl}/api/campaigns/${campaignId}/maps`, {
      headers: { cookie: cookies.viewer },
    })
    expect(viewerList.status).toBe(200)
    const viewerPayload = await viewerList.json()
    expect(viewerPayload.data.some((map: { id: string }) => map.id === mapId)).toBe(true)

    const collaboratorPatch = await fetch(`${baseUrl}/api/campaigns/${campaignId}/maps/${mapId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.collaborator,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Collaborator Updated Map' }),
    })
    expect(collaboratorPatch.status).toBe(200)

    const viewerPatch = await fetch(`${baseUrl}/api/campaigns/${campaignId}/maps/${mapId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.viewer,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Viewer Should Not Update Map' }),
    })
    expect(viewerPatch.status).toBe(403)
    const viewerPatchPayload = await viewerPatch.json()
    expect(viewerPatchPayload.error.code).toBe('FORBIDDEN')
  })

  it('allows campaign-linked shared character reads and denies non-owner character writes', async () => {
    const collaboratorCharacterGet = await fetch(`${baseUrl}/api/characters/${sharedCharacterId}`, {
      headers: { cookie: cookies.collaborator },
    })
    expect(collaboratorCharacterGet.status).toBe(200)
    const collaboratorCharacterPayload = await collaboratorCharacterGet.json()
    expect(collaboratorCharacterPayload.data.id).toBe(sharedCharacterId)
    expect(collaboratorCharacterPayload.data.canEdit).toBe(false)

    const viewerCharacterGet = await fetch(`${baseUrl}/api/characters/${sharedCharacterId}`, {
      headers: { cookie: cookies.viewer },
    })
    expect(viewerCharacterGet.status).toBe(200)

    const outsiderCharacterGet = await fetch(`${baseUrl}/api/characters/${sharedCharacterId}`, {
      headers: { cookie: cookies.outsider },
    })
    expect(outsiderCharacterGet.status).toBe(404)

    const collaboratorPatch = await fetch(`${baseUrl}/api/characters/${sharedCharacterId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.collaborator,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Collaborator Rename Attempt' }),
    })
    expect(collaboratorPatch.status).toBe(403)
    const collaboratorPatchPayload = await collaboratorPatch.json()
    expect(collaboratorPatchPayload.error.code).toBe('FORBIDDEN')
  })
})
