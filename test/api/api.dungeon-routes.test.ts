// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'

const prisma = createApiTestPrismaClient()
const hash = new Hash(new Scrypt())
const baseUrl = getApiTestBaseUrl()
const password = 'dungeon-api-pass'

const users = {
  owner: { email: 'dungeon-owner@example.com', name: 'Dungeon Owner' },
  viewer: { email: 'dungeon-viewer@example.com', name: 'Dungeon Viewer' },
}

const cookies: Record<string, string> = {}
let campaignId = ''
let dungeonId = ''
let roomId = ''
let linkId = ''
let snapshotId = ''

const loginAndGetCookie = async (email: string) => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '198.51.100.21',
    },
    body: JSON.stringify({ email, password }),
  })
  expect(response.status).toBe(200)
  const rawCookie = response.headers.get('set-cookie') || ''
  const match = rawCookie.match(/nuxt-session=[^;]+/)
  return match?.[0] || ''
}

describe('dungeon API routes', () => {
  beforeAll(async () => {
    const passwordHash = await hash.make(password)
    const emails = Object.values(users).map((user) => user.email)

    await prisma.campaignMember.deleteMany({ where: { user: { email: { in: emails } } } })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })

    const createdUsers = await Promise.all(
      Object.values(users).map((user) =>
        prisma.user.create({
          data: {
            email: user.email,
            name: user.name,
            passwordHash,
          },
          select: { id: true, email: true },
        }),
      ),
    )

    const ownerId = createdUsers.find((user) => user.email === users.owner.email)?.id as string
    const viewerId = createdUsers.find((user) => user.email === users.viewer.email)?.id as string

    const campaign = await prisma.campaign.create({
      data: {
        ownerId,
        name: 'Dungeon API Campaign',
        members: {
          create: [
            { userId: ownerId, role: 'OWNER', invitedByUserId: ownerId },
            { userId: viewerId, role: 'VIEWER', invitedByUserId: ownerId },
          ],
        },
      },
      select: { id: true },
    })

    campaignId = campaign.id
    cookies.owner = await loginAndGetCookie(users.owner.email)
    cookies.viewer = await loginAndGetCookie(users.viewer.email)
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates dungeon, generates/regenerates, and enforces viewer read-only', async () => {
    const createResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Catacomb Wing',
        theme: 'crypt',
        seed: 'fixed-seed-a',
      }),
    })
    expect(createResponse.status).toBe(200)
    const createdPayload = await createResponse.json()
    dungeonId = createdPayload.data.id

    const listResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons`, {
      headers: { cookie: cookies.viewer },
    })
    expect(listResponse.status).toBe(200)
    const listPayload = await listResponse.json()
    expect(listPayload.data.some((entry: { id: string }) => entry.id === dungeonId)).toBe(true)

    const generateResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/generate`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.owner,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          seed: 'fixed-seed-a',
        }),
      },
    )
    expect(generateResponse.status).toBe(200)
    const generatedPayload = await generateResponse.json()
    const generatedHash = generatedPayload.data.map.metadata.configHash

    const regenerateDoors = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/regenerate`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.owner,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          scope: 'DOORS',
          seed: 'fixed-seed-a',
        }),
      },
    )
    expect(regenerateDoors.status).toBe(200)

    const detailResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`, {
      headers: { cookie: cookies.owner },
    })
    expect(detailResponse.status).toBe(200)
    const detailPayload = await detailResponse.json()
    expect(detailPayload.data.map.metadata.configHash).toBe(generatedHash)
    expect(detailPayload.data.map.rooms.length).toBeGreaterThan(0)
    roomId = detailPayload.data.map.rooms[0].id as string

    const roomsResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/rooms`, {
      headers: { cookie: cookies.owner },
    })
    expect(roomsResponse.status).toBe(200)
    const roomsPayload = await roomsResponse.json()
    const room = roomsPayload.data[0]
    expect(room).toBeTruthy()
    const roomRowId = room.id as string

    const updateRoomResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/rooms/${roomRowId}`,
      {
        method: 'PATCH',
        headers: {
          cookie: cookies.owner,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Edited Room',
          gmNotes: 'Secret lever behind statue',
          state: 'EXPLORED',
        }),
      },
    )
    expect(updateRoomResponse.status).toBe(200)

    const createEncounterFromRoomResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/rooms/${roomRowId}/create-encounter`,
      {
        method: 'POST',
        headers: { cookie: cookies.owner },
      },
    )
    expect(createEncounterFromRoomResponse.status).toBe(200)
    const encounterFromRoomPayload = await createEncounterFromRoomResponse.json()
    expect(encounterFromRoomPayload.data.encounterId).toBeTruthy()

    const patchMapResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/map`,
      {
        method: 'PATCH',
        headers: {
          cookie: cookies.owner,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          actions: [
            {
              type: 'MOVE_ROOM',
              roomId,
              x: 3,
              y: 3,
            },
          ],
        }),
      },
    )
    expect(patchMapResponse.status).toBe(200)

    const createLinkResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/links`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.owner,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          linkType: 'QUEST',
          targetId: 'quest-xyz',
        }),
      },
    )
    expect(createLinkResponse.status).toBe(200)
    const linkPayload = await createLinkResponse.json()
    linkId = linkPayload.data.id as string

    const listLinksResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/links`, {
      headers: { cookie: cookies.owner },
    })
    expect(listLinksResponse.status).toBe(200)
    const linksPayload = await listLinksResponse.json()
    expect(linksPayload.data.some((entry: { id: string }) => entry.id === linkId)).toBe(true)

    const viewerPatchMap = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/map`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.viewer,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        actions: [{ type: 'REMOVE_ROOM', roomId }],
      }),
    })
    expect(viewerPatchMap.status).toBe(404)

    const deleteLinkResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/links/${linkId}`,
      {
        method: 'DELETE',
        headers: { cookie: cookies.owner },
      },
    )
    expect(deleteLinkResponse.status).toBe(200)

    const viewerPatch = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.viewer,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Viewer edit denied' }),
    })
    expect(viewerPatch.status).toBe(404)

    const viewerRoomsResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/rooms`, {
      headers: { cookie: cookies.viewer },
    })
    expect(viewerRoomsResponse.status).toBe(200)
    const viewerRoomsPayload = await viewerRoomsResponse.json()
    expect(viewerRoomsPayload.data[0].gmNotes).toBeNull()

    const ownerPublishResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/publish`, {
      method: 'POST',
      headers: { cookie: cookies.owner },
    })
    expect(ownerPublishResponse.status).toBe(200)
    const publishPayload = await ownerPublishResponse.json()
    expect(publishPayload.data.status).toBe('READY')

    const viewerUnpublishResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/unpublish`,
      {
        method: 'POST',
        headers: { cookie: cookies.viewer },
      },
    )
    expect(viewerUnpublishResponse.status).toBe(404)

    const ownerUnpublishResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/unpublish`,
      {
        method: 'POST',
        headers: { cookie: cookies.owner },
      },
    )
    expect(ownerUnpublishResponse.status).toBe(200)
    const unpublishPayload = await ownerUnpublishResponse.json()
    expect(unpublishPayload.data.status).toBe('DRAFT')
  })

  it('supports snapshot create/list/restore', async () => {
    const beforePatch = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/map`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        actions: [{ type: 'MOVE_ROOM', roomId, x: 10, y: 10 }],
      }),
    })
    expect(beforePatch.status).toBe(200)

    const createSnapshotResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/snapshots`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.owner,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ snapshotType: 'MANUAL' }),
      },
    )
    expect(createSnapshotResponse.status).toBe(200)
    const createSnapshotPayload = await createSnapshotResponse.json()
    snapshotId = createSnapshotPayload.data.id as string
    expect(createSnapshotPayload.data.snapshotType).toBe('MANUAL')

    const mutateAfterSnapshot = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/map`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        actions: [{ type: 'MOVE_ROOM', roomId, x: 14, y: 14 }],
      }),
    })
    expect(mutateAfterSnapshot.status).toBe(200)

    const listSnapshotsResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/snapshots`,
      {
        headers: { cookie: cookies.owner },
      },
    )
    expect(listSnapshotsResponse.status).toBe(200)
    const listSnapshotsPayload = await listSnapshotsResponse.json()
    expect(listSnapshotsPayload.data.some((entry: { id: string }) => entry.id === snapshotId)).toBe(true)

    const restoreSnapshotResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/snapshots/${snapshotId}/restore`,
      {
        method: 'POST',
        headers: { cookie: cookies.owner },
      },
    )
    expect(restoreSnapshotResponse.status).toBe(200)

    const detailResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`, {
      headers: { cookie: cookies.owner },
    })
    expect(detailResponse.status).toBe(200)
    const detailPayload = await detailResponse.json()
    const restoredRoom = detailPayload.data.map.rooms.find((entry: { id: string }) => entry.id === roomId)
    expect(restoredRoom.x).toBe(10)
    expect(restoredRoom.y).toBe(10)
  })

  it('exports JSON/SVG, supports import, and rejects oversized import payloads', async () => {
    const addSecretRoomResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/map`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        actions: [{ type: 'ADD_ROOM', x: 30, y: 30, width: 6, height: 6, isSecret: true }],
      }),
    })
    expect(addSecretRoomResponse.status).toBe(200)

    const exportDmResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/export`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        format: 'JSON',
        playerSafe: false,
      }),
    })
    expect(exportDmResponse.status).toBe(200)
    const exportDmPayload = await exportDmResponse.json()
    expect(exportDmPayload.data.filename.endsWith('.json')).toBe(true)
    const dmDocument = JSON.parse(exportDmPayload.data.content as string)
    const dmHasSecretRoom = dmDocument.dungeon.map.rooms.some((entry: { isSecret: boolean }) => entry.isSecret)
    expect(dmHasSecretRoom).toBe(true)

    const exportPlayerResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/export`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        format: 'JSON',
        playerSafe: true,
      }),
    })
    expect(exportPlayerResponse.status).toBe(200)
    const exportPlayerPayload = await exportPlayerResponse.json()
    const playerDocument = JSON.parse(exportPlayerPayload.data.content as string)
    const playerHasSecretRoom = playerDocument.dungeon.map.rooms.some(
      (entry: { isSecret: boolean }) => entry.isSecret,
    )
    expect(playerHasSecretRoom).toBe(false)
    expect(playerDocument.rooms.every((entry: { gmNotes: string | null }) => entry.gmNotes === null)).toBe(true)

    const exportSvgResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/export`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        format: 'SVG',
        playerSafe: true,
      }),
    })
    expect(exportSvgResponse.status).toBe(200)
    const exportSvgPayload = await exportSvgResponse.json()
    expect(exportSvgPayload.data.filename.endsWith('.svg')).toBe(true)
    expect((exportSvgPayload.data.content as string).startsWith('<?xml')).toBe(true)

    const exportPngResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/export`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        format: 'PNG',
        playerSafe: true,
      }),
    })
    expect(exportPngResponse.status).toBe(200)
    const exportPngPayload = await exportPngResponse.json()
    expect(exportPngPayload.data.filename.endsWith('.png')).toBe(true)
    expect(exportPngPayload.data.encoding).toBe('base64')

    const exportPdfResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/export`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        format: 'PDF',
        playerSafe: true,
      }),
    })
    expect(exportPdfResponse.status).toBe(200)
    const exportPdfPayload = await exportPdfResponse.json()
    expect(exportPdfPayload.data.filename.endsWith('.pdf')).toBe(true)
    expect(exportPdfPayload.data.encoding).toBe('base64')

    const viewerForcedSafeExportResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/export`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.viewer,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          format: 'JSON',
          playerSafe: false,
        }),
      },
    )
    expect(viewerForcedSafeExportResponse.status).toBe(200)
    const viewerForcedSafeExportPayload = await viewerForcedSafeExportResponse.json()
    const viewerDocument = JSON.parse(viewerForcedSafeExportPayload.data.content as string)
    expect(viewerDocument.rooms.every((entry: { gmNotes: string | null }) => entry.gmNotes === null)).toBe(true)

    const importResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/import`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: playerDocument,
        nameOverride: 'Imported Safe Dungeon',
      }),
    })
    expect(importResponse.status).toBe(200)
    const importPayload = await importResponse.json()
    expect(importPayload.data.id).toBeTruthy()

    const importedDetailResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${importPayload.data.id}`,
      {
        headers: { cookie: cookies.owner },
      },
    )
    expect(importedDetailResponse.status).toBe(200)
    const importedDetailPayload = await importedDetailResponse.json()
    expect(importedDetailPayload.data.name).toBe('Imported Safe Dungeon')

    const oversizedPayload = {
      source: playerDocument,
      nameOverride: 'x'.repeat(2_000_100),
    }
    const oversizedResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/import`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify(oversizedPayload),
    })
    expect(oversizedResponse.status).toBe(413)
  })
})
