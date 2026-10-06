// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import sharp from 'sharp'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestDatabase } from '../scripts/db-test-client'
import * as tables from '../../server/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

const db = createApiTestDatabase()
const hash = new Hash(new Scrypt({}))
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

    db.delete(tables.campaignMember).where(inArray(tables.campaignMember.userId, db.select({ id: tables.user.id }).from(tables.user).where(inArray(tables.user.email, emails)))).run()
    db.delete(tables.user).where(inArray(tables.user.email, emails)).run()

    const createdUsers = await Promise.all(
      Object.values(users).map((user) =>
        db.insert(tables.user).values({
          email: user.email,
          name: user.name,
          passwordHash,
        }).returning().get()!,
      ),
    )

    const ownerId = createdUsers.find((user) => user.email === users.owner.email)?.id as string
    const viewerId = createdUsers.find((user) => user.email === users.viewer.email)?.id as string

    const campaign = db.insert(tables.campaign).values({ ownerId: ownerId, name: 'Dungeon API Campaign' }).returning().get()!
    db.insert(tables.campaignMember).values(([
      { userId: ownerId, role: 'OWNER', invitedByUserId: ownerId },
      { userId: viewerId, role: 'VIEWER', invitedByUserId: ownerId },
    ] as const).map(member => ({ ...member, campaignId: campaign.id }))).run()

    campaignId = campaign.id
    cookies.owner = await loginAndGetCookie(users.owner.email)
    cookies.viewer = await loginAndGetCookie(users.viewer.email)
  }, 120_000)

  afterAll(async () => {
    db.$client.close()
  })

  it('preserves building floors, stairs and floor edits through exports, imports and snapshots', { timeout: 30_000 }, async () => {
    const headers = { cookie: cookies.owner, 'content-type': 'application/json' }
    const collectionUrl = `${baseUrl}/api/campaigns/${campaignId}/dungeons`
    const createResponse = await fetch(collectionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Three-storey Watch House',
        seed: 'watch-house-contract',
        config: {
          mapType: 'BUILDING', floorCount: 3, encounterFlow: 'LOOP', encounterScale: 'COMPLEX',
          accessPoints: { entrances: 2, exits: 2, entranceSide: 'NORTH', concealedEntrance: true },
          tacticalTerrain: { cover: 'HEAVY', elevation: true, difficultTerrain: true, hazards: true, sightlines: 'BROKEN' },
          verticalConnections: { basement: true, staircases: 'DUAL', ladders: true, balconies: true, bridges: true },
        },
      }),
    })
    expect(createResponse.status).toBe(200)
    const created = (await createResponse.json()).data
    const resourceUrl = `${collectionUrl}/${created.id}`
    expect(created).toMatchObject({ mapType: 'BUILDING', floorCount: 3 })
    expect(created.config).toMatchObject({
      mapType: 'BUILDING', floorCount: 3, encounterFlow: 'LOOP', encounterScale: 'COMPLEX',
      accessPoints: { entrances: 2, exits: 2, entranceSide: 'NORTH', concealedEntrance: true },
      tacticalTerrain: { cover: 'HEAVY', elevation: true, difficultTerrain: true, hazards: true, sightlines: 'BROKEN' },
      verticalConnections: { basement: true, staircases: 'DUAL', ladders: true, balconies: true, bridges: true },
    })
    expect(created.map).toMatchObject({ mapType: 'BUILDING', floorCount: 3 })
    expect(created.map.floorLabels).toHaveLength(3)
    expect(created.map.floorLabels[0].toLowerCase()).toContain('basement')
    const rooms = created.map.rooms as {
      id: string
      floor?: number
      roomNumber: number
      label?: string
      kind?: string
      x: number
      y: number
      width: number
      height: number
    }[]
    expect(new Set(rooms.map(room => room.floor ?? 0))).toEqual(new Set([0, 1, 2]))
    expect(rooms.every(room => Boolean(room.label))).toBe(true)
    expect(created.map.stairs.filter((stair: { kind?: string }) => (stair.kind ?? 'STAIRS') === 'STAIRS').length).toBeGreaterThanOrEqual(4)
    expect(created.map.stairs.some((stair: { kind?: string }) => stair.kind === 'LADDER')).toBe(true)
    expect(rooms.some(room => room.kind === 'BALCONY')).toBe(true)
    expect(created.map.corridors.some((corridor: { kind?: string }) => corridor.kind === 'BRIDGE')).toBe(true)
    const listed = (await fetch(collectionUrl, { headers }).then(response => response.json())).data as { id: string }[]
    expect(listed.find(map => map.id === created.id)).toMatchObject({ mapType: 'BUILDING', floorCount: 3 })
    for (const stair of created.map.stairs as { fromRoomId: string, toRoomId: string, x: number, y: number, width: number, height: number, kind?: string }[]) {
      const from = rooms.find(room => room.id === stair.fromRoomId)!
      const to = rooms.find(room => room.id === stair.toRoomId)!
      expect(Math.abs((from.floor ?? 0) - (to.floor ?? 0))).toBe(1)
      if ((stair.kind ?? 'STAIRS') === 'STAIRS') {
        expect(from.kind).toBe('STAIRWELL')
        expect(to.kind).toBe('STAIRWELL')
      }
      expect(stair.width).toBeGreaterThan(0)
      expect(stair.height).toBeGreaterThan(0)
      for (const room of [from, to]) {
        expect(stair.x).toBeGreaterThanOrEqual(room.x)
        expect(stair.y).toBeGreaterThanOrEqual(room.y)
        expect(stair.x + stair.width).toBeLessThanOrEqual(room.x + room.width)
        expect(stair.y + stair.height).toBeLessThanOrEqual(room.y + room.height)
      }
    }
    expect(created.map.flow).toMatchObject({ style: 'LOOP' })
    const flow = created.map.flow as { entryRoomId: string, objectiveRoomId: string, exitRoomId: string, routeRoomIds: string[] }
    expect(flow.routeRoomIds[0]).toBe(flow.entryRoomId)
    expect(flow.routeRoomIds.at(-1)).toBe(flow.exitRoomId)
    expect(flow.routeRoomIds).toContain(flow.objectiveRoomId)
    const connections = [...created.map.corridors, ...created.map.stairs] as { fromRoomId: string, toRoomId: string }[]
    for (let index = 1; index < flow.routeRoomIds.length; index += 1) {
      const from = flow.routeRoomIds[index - 1]
      const to = flow.routeRoomIds[index]
      expect(connections.some(edge => (edge.fromRoomId === from && edge.toRoomId === to) || (edge.fromRoomId === to && edge.toRoomId === from))).toBe(true)
    }
    expect(created.map.portals).toHaveLength(5)
    expect(created.map.portals.filter((portal: { kind: string, isSecret?: boolean }) => portal.kind === 'ENTRANCE' && !portal.isSecret)).toHaveLength(2)
    expect(created.map.portals.filter((portal: { kind: string, isSecret?: boolean }) => portal.kind === 'EXIT' && !portal.isSecret)).toHaveLength(2)
    expect(created.map.portals.filter((portal: { isSecret?: boolean }) => portal.isSecret)).toHaveLength(1)
    expect(created.map.portals.some((portal: { kind: string, roomId: string, isSecret?: boolean }) => portal.kind === 'ENTRANCE' && portal.roomId === flow.entryRoomId && !portal.isSecret)).toBe(true)
    expect(created.map.portals.some((portal: { kind: string, roomId: string, isSecret?: boolean }) => portal.kind === 'EXIT' && portal.roomId === flow.exitRoomId && !portal.isSecret)).toBe(true)
    for (const portal of created.map.portals as { id: string, kind: string, roomId: string, isSecret?: boolean, points: { x: number, y: number }[] }[]) {
      const room = rooms.find(room => room.id === portal.roomId)!
      const start = portal.points[0]!
      const end = portal.points.at(-1)!
      expect(start.x >= room.x && start.x < room.x + room.width && start.y >= room.y && start.y < room.y + room.height).toBe(true)
      expect(start.x === room.x || start.x === room.x + room.width - 1 || start.y === room.y || start.y === room.y + room.height - 1).toBe(true)
      expect(end.x === 0 || end.y === 0 || end.x === created.map.width - 1 || end.y === created.map.height - 1).toBe(true)
      for (let index = 1; index < portal.points.length; index += 1) {
        expect(portal.points[index]!.x === portal.points[index - 1]!.x || portal.points[index]!.y === portal.points[index - 1]!.y).toBe(true)
      }
      if (portal.id === 'portal-entrance') expect(end.y).toBe(0)
    }
    const tacticalKinds = ['COVER', 'ELEVATION', 'DIFFICULT', 'HAZARD']
    for (const kind of tacticalKinds) expect(created.map.terrain.some((feature: { kind: string }) => feature.kind === kind)).toBe(true)
    for (const feature of created.map.terrain as { roomId?: string, kind: string, floor?: number, x: number, y: number, width: number, height: number }[]) {
      if (!tacticalKinds.includes(feature.kind)) continue
      const owner = rooms.find(room => room.id === feature.roomId)!
      expect(owner).toBeDefined()
      expect(feature.floor ?? 0).toBe(owner.floor ?? 0)
      expect(feature.x).toBeGreaterThanOrEqual(owner.x)
      expect(feature.y).toBeGreaterThanOrEqual(owner.y)
      expect(feature.x + feature.width).toBeLessThanOrEqual(owner.x + owner.width)
      expect(feature.y + feature.height).toBeLessThanOrEqual(owner.y + owner.height)
    }

    const editResponse = await fetch(`${resourceUrl}/map`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ actions: [
        { type: 'PAINT_ZONE', zoneType: 'HAZARD', label: 'Weak attic floor', cells: [{ x: 0, y: 0 }], floor: 2 },
      ] }),
    })
    expect(editResponse.status).toBe(200)
    const edited = (await fetch(resourceUrl, { headers }).then(response => response.json())).data
    expect(edited.map.rooms).toEqual(created.map.rooms)
    expect(edited.map.zones.at(-1)).toMatchObject({ floor: 2, label: 'Weak attic floor' })
    expect(edited.map.stairs).toEqual(created.map.stairs)
    expect(edited.map.portals).toEqual(created.map.portals)
    expect(edited.map.flow).toEqual(created.map.flow)

    const crossFloorCorridor = await fetch(`${resourceUrl}/map`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ actions: [{
        type: 'ADD_CORRIDOR',
        fromRoomId: rooms.find(room => (room.floor ?? 0) === 0)!.id,
        toRoomId: rooms.find(room => room.floor === 1)!.id,
        points: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
      }] }),
    })
    expect(crossFloorCorridor.status).toBe(400)
    const removeLanding = await fetch(`${resourceUrl}/map`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ actions: [{ type: 'REMOVE_ROOM', roomId: created.map.stairs[0].fromRoomId }] }),
    })
    expect(removeLanding.status).toBe(400)
    const stair = created.map.stairs[0]
    const stairwell = rooms.find(room => room.id === stair.fromRoomId)!
    const clipStairResponse = await fetch(`${resourceUrl}/map`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ actions: [{
        type: 'RESIZE_ROOM', roomId: stairwell.id,
        width: stairwell.width, height: stair.y - stairwell.y + stair.height - 1,
      }] }),
    })
    expect(clipStairResponse.status).toBe(400)
    const invalidFloor = await fetch(`${resourceUrl}/map`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ actions: [{ type: 'ADD_ROOM', x: 0, y: 0, width: 2, height: 2, floor: 3 }] }),
    })
    expect(invalidFloor.status).toBe(400)

    const svgResponse = await fetch(resourceUrl, {
      method: 'PATCH', headers, body: JSON.stringify({ action: 'export', format: 'SVG', floor: 1 }),
    })
    expect(svgResponse.status).toBe(200)
    const svg = (await svgResponse.json()).data.content as string
    for (const room of rooms) {
      if (room.floor === 1) expect(svg).toContain(`data-room-id="${room.id}"`)
      else expect(svg).not.toContain(`data-room-id="${room.id}"`)
    }
    const jsonResponse = await fetch(resourceUrl, {
      method: 'PATCH', headers, body: JSON.stringify({ action: 'export', format: 'JSON', floor: 1 }),
    })
    expect(jsonResponse.status).toBe(200)
    const document = JSON.parse((await jsonResponse.json()).data.content)
    expect(document.dungeon.map).toEqual(edited.map)
    for (const malformed of ['portal-reference', 'portal-route', 'flow-reference', 'flow-route', 'secret-primary', 'terrain-reference', 'terrain-floor', 'floor-labels', 'stair-kind'] as const) {
      const invalidDocument = structuredClone(document)
      if (malformed === 'portal-reference') invalidDocument.dungeon.map.portals[0].roomId = 'missing-room'
      if (malformed === 'portal-route') invalidDocument.dungeon.map.portals[0].points = [{ x: 1, y: 1 }, { x: 2, y: 2 }]
      if (malformed === 'flow-reference') invalidDocument.dungeon.map.flow.objectiveRoomId = 'missing-room'
      if (malformed === 'flow-route') invalidDocument.dungeon.map.flow.routeRoomIds = [flow.entryRoomId, flow.objectiveRoomId, flow.exitRoomId]
      if (malformed === 'secret-primary') {
        for (const portal of invalidDocument.dungeon.map.portals) {
          if (portal.kind === 'ENTRANCE' && portal.roomId === flow.entryRoomId) portal.isSecret = true
        }
      }
      if (malformed === 'terrain-reference') invalidDocument.dungeon.map.terrain.find((feature: { roomId?: string }) => feature.roomId).roomId = 'missing-room'
      if (malformed === 'terrain-floor') {
        const feature = invalidDocument.dungeon.map.terrain.find((feature: { roomId?: string }) => feature.roomId)
        feature.floor = ((feature.floor ?? 0) + 1) % created.map.floorCount
      }
      if (malformed === 'floor-labels') invalidDocument.dungeon.map.floorLabels.pop()
      if (malformed === 'stair-kind') invalidDocument.dungeon.map.stairs[0].kind = 'RAMP'
      const rejected = await fetch(collectionUrl, {
        method: 'POST', headers, body: JSON.stringify({ action: 'import', source: invalidDocument }),
      })
      expect(rejected.status, malformed).toBe(400)
    }
    const importResponse = await fetch(collectionUrl, {
      method: 'POST', headers, body: JSON.stringify({ action: 'import', source: document }),
    })
    expect(importResponse.status).toBe(200)
    const importedId = (await importResponse.json()).data.id
    const imported = (await fetch(`${collectionUrl}/${importedId}`, { headers }).then(response => response.json())).data
    expect(imported.map).toEqual(edited.map)
    expect(imported.config).toEqual(edited.config)
    const importedRooms = (await fetch(`${collectionUrl}/${importedId}/rooms`, { headers }).then(response => response.json())).data as {
      roomNumber: number
      name: string
      bounds: { floor?: number }
    }[]
    for (const room of rooms) {
      const record = importedRooms.find(record => record.roomNumber === room.roomNumber)!
      expect(record.bounds.floor ?? 0).toBe(room.floor ?? 0)
      expect(record.name).toBe(room.label)
    }

    const snapshotResponse = await fetch(`${resourceUrl}/snapshots`, {
      method: 'POST', headers, body: JSON.stringify({ snapshotType: 'MANUAL' }),
    })
    expect(snapshotResponse.status).toBe(200)
    const savedSnapshotId = (await snapshotResponse.json()).data.id
    const regenerateResponse = await fetch(resourceUrl, {
      method: 'PATCH', headers, body: JSON.stringify({ action: 'regenerate', scope: 'DOORS' }),
    })
    expect(regenerateResponse.status).toBe(200)
    const regenerated = (await regenerateResponse.json()).data
    expect(regenerated.map.stairs).toEqual(edited.map.stairs)
    expect(regenerated.map.rooms).toEqual(edited.map.rooms)
    expect(regenerated.map.portals).toEqual(edited.map.portals)
    expect(regenerated.map.flow).toEqual(edited.map.flow)
    const restoreResponse = await fetch(`${resourceUrl}/snapshots/${savedSnapshotId}/restore`, { method: 'POST', headers })
    expect(restoreResponse.status).toBe(200)
    const restored = (await fetch(resourceUrl, { headers }).then(response => response.json())).data
    expect(restored.map).toEqual(edited.map)
    const playerResponse = await fetch(resourceUrl, {
      method: 'PATCH', headers, body: JSON.stringify({ action: 'export', format: 'JSON', playerSafe: true }),
    })
    expect(playerResponse.status).toBe(200)
    const playerDocument = JSON.parse((await playerResponse.json()).data.content)
    expect(playerDocument.dungeon.map.flow).toBeUndefined()
    expect(playerDocument.dungeon.map.portals.some((portal: { isSecret?: boolean }) => portal.isSecret)).toBe(false)
    expect(playerDocument.dungeon.config.accessPoints.concealedEntrance).toBe(false)

    const legacyDocument = structuredClone(document)
    delete legacyDocument.dungeon.config.encounterFlow
    delete legacyDocument.dungeon.config.encounterScale
    delete legacyDocument.dungeon.config.accessPoints
    delete legacyDocument.dungeon.config.tacticalTerrain
    delete legacyDocument.dungeon.config.verticalConnections
    delete legacyDocument.dungeon.map.flow
    delete legacyDocument.dungeon.map.portals
    delete legacyDocument.dungeon.map.floorLabels
    for (const room of legacyDocument.dungeon.map.rooms) delete room.kind
    for (const stair of legacyDocument.dungeon.map.stairs) {
      delete stair.width
      delete stair.height
      delete stair.kind
    }
    const legacyImportResponse = await fetch(collectionUrl, {
      method: 'POST', headers, body: JSON.stringify({ action: 'import', source: legacyDocument }),
    })
    expect(legacyImportResponse.status).toBe(200)
    const legacyId = (await legacyImportResponse.json()).data.id
    const legacy = (await fetch(`${collectionUrl}/${legacyId}`, { headers }).then(response => response.json())).data
    expect(legacy.config.encounterFlow).toBe('BRANCHING')
    expect(legacy.config.encounterScale).toBe('SEQUENCE')
    expect(legacy.map.flow).toBeUndefined()
    expect(legacy.map.portals).toBeUndefined()

    const wallResponse = await fetch(`${resourceUrl}/map`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ actions: [{ type: 'DRAW_WALL_SEGMENT', x1: 0, y1: 0, x2: 2, y2: 0, floor: 2 }] }),
    })
    expect(wallResponse.status).toBe(200)
    const walled = (await fetch(resourceUrl, { headers }).then(response => response.json())).data
    expect(walled.map.walls.at(-1)).toMatchObject({ floor: 2 })
    expect(walled.map.flow).toBeUndefined()
    const addRoomResponse = await fetch(`${resourceUrl}/map`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ actions: [{ type: 'ADD_ROOM', x: 0, y: 0, width: 2, height: 2, floor: 2, isSecret: true }] }),
    })
    expect(addRoomResponse.status).toBe(200)
    const custom = (await fetch(resourceUrl, { headers }).then(response => response.json())).data
    expect(custom.map.rooms.at(-1)).toMatchObject({ x: 0, y: 0, floor: 2 })
    expect(custom.map.flow).toBeUndefined()
    expect(custom.map.portals).toEqual(created.map.portals)
    const hiddenGeometry = custom.map.rooms.at(-1)
    const roomRecords = (await fetch(`${resourceUrl}/rooms`, { headers }).then(response => response.json())).data
    const hiddenRecord = roomRecords.find((room: { roomNumber: number }) => room.roomNumber === hiddenGeometry.roomNumber)
    const hiddenLinkResponse = await fetch(`${resourceUrl}/links`, {
      method: 'POST', headers,
      body: JSON.stringify({ roomId: hiddenRecord.id, linkType: 'QUEST', targetId: 'hidden-access-contract' }),
    })
    expect(hiddenLinkResponse.status).toBe(200)
    const hiddenLinkId = (await hiddenLinkResponse.json()).data.id
    const viewerExportResponse = await fetch(resourceUrl, {
      method: 'PATCH', headers: { ...headers, cookie: cookies.viewer },
      body: JSON.stringify({ action: 'export', format: 'JSON', playerSafe: false }),
    })
    expect(viewerExportResponse.status).toBe(200)
    const viewerDocument = JSON.parse((await viewerExportResponse.json()).data.content)
    expect(viewerDocument.dungeon.map.portals.every((portal: { isSecret?: boolean }) => !portal.isSecret)).toBe(true)
    expect(viewerDocument.dungeon.config.accessPoints.concealedEntrance).toBe(false)
    expect(viewerDocument.rooms.some((room: { id: string }) => room.id === hiddenRecord.id)).toBe(false)
    expect(viewerDocument.links.some((link: { id: string }) => link.id === hiddenLinkId)).toBe(false)
    const viewerDetail = (await fetch(resourceUrl, { headers: { cookie: cookies.viewer } }).then(response => response.json())).data
    expect(viewerDetail.config.accessPoints.concealedEntrance).toBe(false)
    expect(viewerDetail.map.portals.every((portal: { isSecret?: boolean }) => !portal.isSecret)).toBe(true)
    const viewerRooms = (await fetch(`${resourceUrl}/rooms`, { headers: { cookie: cookies.viewer } }).then(response => response.json())).data
    expect(viewerRooms.some((room: { id: string }) => room.id === hiddenRecord.id)).toBe(false)
    const entryRoom = rooms.find(room => room.id === flow.entryRoomId)!
    const outOfBoundsEntryResponse = await fetch(`${resourceUrl}/map`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ actions: [{ type: 'MOVE_ROOM', roomId: entryRoom.id, x: created.map.width, y: entryRoom.y }] }),
    })
    expect(outOfBoundsEntryResponse.status).toBe(400)
    const unchangedResponse = await fetch(resourceUrl, { headers })
    expect(unchangedResponse.status).toBe(200)
    expect((await unchangedResponse.json()).data.map).toEqual(custom.map)
    const moveEntryResponse = await fetch(`${resourceUrl}/map`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ actions: [{ type: 'MOVE_ROOM', roomId: entryRoom.id, x: entryRoom.x, y: entryRoom.y - 1 }] }),
    })
    expect(moveEntryResponse.status).toBe(200)
    const moved = (await fetch(resourceUrl, { headers }).then(response => response.json())).data
    const oldEntrance = created.map.portals.find((portal: { kind: string, roomId: string, isSecret?: boolean }) => portal.kind === 'ENTRANCE' && portal.roomId === flow.entryRoomId && !portal.isSecret)
    const movedEntrance = moved.map.portals.find((portal: { id: string }) => portal.id === oldEntrance.id)
    expect(movedEntrance.points[0].y).toBe(oldEntrance.points[0].y - 1)
    const oldEdge = oldEntrance.points.at(-1)
    const movedEdge = movedEntrance.points.at(-1)
    if (oldEdge.x === 0 || oldEdge.x === created.map.width - 1) expect(movedEdge.x).toBe(oldEdge.x)
    if (oldEdge.y === 0 || oldEdge.y === created.map.height - 1) expect(movedEdge.y).toBe(oldEdge.y)
    const removeEntryResponse = await fetch(`${resourceUrl}/map`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ actions: [{ type: 'REMOVE_ROOM', roomId: flow.entryRoomId }] }),
    })
    expect(removeEntryResponse.status).toBe(200)
    const withoutEntry = (await fetch(resourceUrl, { headers }).then(response => response.json())).data
    expect(withoutEntry.map.portals.every((portal: { roomId: string }) => portal.roomId !== flow.entryRoomId)).toBe(true)

    const terrainRoom = rooms.find(room => room.kind === 'ROOM' && room.id !== flow.entryRoomId
      && withoutEntry.map.terrain.some((feature: { roomId?: string }) => feature.roomId === room.id)
      && !withoutEntry.map.stairs.some((connection: { fromRoomId: string, toRoomId: string }) => connection.fromRoomId === room.id || connection.toRoomId === room.id)
      && !withoutEntry.map.portals.some((portal: { roomId: string }) => portal.roomId === room.id))!
    expect(terrainRoom).toBeDefined()
    const ownedTerrain = withoutEntry.map.terrain.filter((feature: { roomId?: string }) => feature.roomId === terrainRoom.id) as {
      id: string, x: number, y: number, width: number, height: number
    }[]
    const shiftX = terrainRoom.x + terrainRoom.width < created.map.width ? 1 : -1
    const moveTerrainRoomResponse = await fetch(`${resourceUrl}/map`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ actions: [{ type: 'MOVE_ROOM', roomId: terrainRoom.id, x: terrainRoom.x + shiftX, y: terrainRoom.y }] }),
    })
    expect(moveTerrainRoomResponse.status).toBe(200)
    const withMovedTerrain = (await fetch(resourceUrl, { headers }).then(response => response.json())).data
    for (const feature of ownedTerrain) {
      expect(withMovedTerrain.map.terrain.find((candidate: { id: string }) => candidate.id === feature.id)).toMatchObject({ x: feature.x + shiftX, y: feature.y, roomId: terrainRoom.id })
    }
    const rightExtent = Math.max(...ownedTerrain.map(feature => feature.x + feature.width - terrainRoom.x))
    const bottomExtent = Math.max(...ownedTerrain.map(feature => feature.y + feature.height - terrainRoom.y))
    if (rightExtent > 2 || bottomExtent > 2) {
      const clippedTerrainResponse = await fetch(`${resourceUrl}/map`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ actions: [{
          type: 'RESIZE_ROOM', roomId: terrainRoom.id,
          width: rightExtent > 2 ? rightExtent - 1 : terrainRoom.width,
          height: rightExtent > 2 ? terrainRoom.height : bottomExtent - 1,
        }] }),
      })
      expect(clippedTerrainResponse.status).toBe(400)
      const unchanged = (await fetch(resourceUrl, { headers }).then(response => response.json())).data
      expect(unchanged.map).toEqual(withMovedTerrain.map)
    }
    const removeTerrainRoomResponse = await fetch(`${resourceUrl}/map`, {
      method: 'PATCH', headers, body: JSON.stringify({ actions: [{ type: 'REMOVE_ROOM', roomId: terrainRoom.id }] }),
    })
    expect(removeTerrainRoomResponse.status).toBe(200)
    const withoutTerrainRoom = (await fetch(resourceUrl, { headers }).then(response => response.json())).data
    expect(withoutTerrainRoom.map.terrain.some((feature: { roomId?: string }) => feature.roomId === terrainRoom.id)).toBe(false)
  })

  it('generates forest terrain, preserves it through regeneration and rejects incompatible floors', async () => {
    const headers = { cookie: cookies.owner, 'content-type': 'application/json' }
    const collectionUrl = `${baseUrl}/api/campaigns/${campaignId}/dungeons`
    const createResponse = await fetch(collectionUrl, {
      method: 'POST', headers,
      body: JSON.stringify({ name: 'Woodland Ambush', seed: 'woodland-contract', config: { mapType: 'FOREST', encounterFlow: 'LINEAR', encounterScale: 'SINGLE', verticalConnections: { bridges: true } } }),
    })
    expect(createResponse.status).toBe(200)
    const created = (await createResponse.json()).data
    expect(created.config).toMatchObject({ mapType: 'FOREST', floorCount: 1, encounterFlow: 'LINEAR', encounterScale: 'SINGLE' })
    expect(created.map).toMatchObject({ mapType: 'FOREST', floorCount: 1 })
    expect(created.map.flow.style).toBe('LINEAR')
    expect(created.map.rooms.every((room: { kind: string }) => room.kind === 'CLEARING')).toBe(true)
    expect(created.map.terrain.length).toBeGreaterThan(0)
    expect(created.map.terrain.every((item: { kind: string }) => ['TREE', 'ROCK', 'BRUSH', 'COVER', 'ELEVATION', 'DIFFICULT', 'HAZARD'].includes(item.kind))).toBe(true)
    expect(created.map.encounters).toHaveLength(1)
    expect(created.map.encounters[0].roomId).toBe(created.map.flow.objectiveRoomId)
    expect(created.map.doors).toHaveLength(0)
    expect(created.map.stairs).toHaveLength(0)
    const resourceUrl = `${collectionUrl}/${created.id}`
    const regenerateResponse = await fetch(resourceUrl, {
      method: 'PATCH', headers, body: JSON.stringify({ action: 'regenerate', scope: 'ENCOUNTERS' }),
    })
    expect(regenerateResponse.status).toBe(200)
    const regenerated = (await regenerateResponse.json()).data
    expect(regenerated.map.terrain).toEqual(created.map.terrain)
    expect(regenerated.map.flow).toEqual(created.map.flow)
    expect(regenerated.map.portals).toEqual(created.map.portals)
    const jsonResponse = await fetch(resourceUrl, {
      method: 'PATCH', headers, body: JSON.stringify({ action: 'export', format: 'JSON' }),
    })
    expect(jsonResponse.status).toBe(200)
    const document = JSON.parse((await jsonResponse.json()).data.content)
    const importResponse = await fetch(collectionUrl, {
      method: 'POST', headers, body: JSON.stringify({ action: 'import', source: document }),
    })
    expect(importResponse.status).toBe(200)
    const importedId = (await importResponse.json()).data.id
    const imported = (await fetch(`${collectionUrl}/${importedId}`, { headers }).then(response => response.json())).data
    expect(imported.map.terrain).toEqual(created.map.terrain)
    const incompatibleResponse = await fetch(collectionUrl, {
      method: 'POST', headers,
      body: JSON.stringify({ name: 'Invalid forest', config: { mapType: 'FOREST', floorCount: 2 } }),
    })
    expect(incompatibleResponse.status).toBe(400)
    for (const config of [
      { mapType: 'FOREST', verticalConnections: { ladders: true } },
      { mapType: 'BUILDING', floorCount: 1, verticalConnections: { basement: true } },
      { mapType: 'BUILDING', floorCount: 2, verticalConnections: { basement: true, balconies: true } },
      { mapType: 'BUILDING', floorCount: 2, accessPoints: { entrances: 0 } },
      { mapType: 'BUILDING', floorCount: 2, accessPoints: { exits: 3 } },
    ]) {
      const invalidOptions = await fetch(collectionUrl, {
        method: 'POST', headers, body: JSON.stringify({ name: 'Invalid map options', config }),
      })
      expect(invalidOptions.status).toBe(400)
    }
  })

  it('applies draft settings only with full or layout regeneration', async () => {
    const headers = { cookie: cookies.owner, 'content-type': 'application/json' }
    const collectionUrl = `${baseUrl}/api/campaigns/${campaignId}/dungeons`
    const createResponse = await fetch(collectionUrl, {
      method: 'POST', headers,
      body: JSON.stringify({ name: 'Regeneration controls', seed: 'regeneration-draft-contract' }),
    })
    expect(createResponse.status).toBe(200)
    const created = (await createResponse.json()).data
    const resourceUrl = `${collectionUrl}/${created.id}`
    const layoutResponse = await fetch(resourceUrl, {
      method: 'PATCH', headers,
      body: JSON.stringify({ action: 'regenerate', scope: 'LAYOUT', config: {
        mapType: 'BUILDING', floorCount: 2, width: 30, height: 30, encounterScale: 'SINGLE',
        accessPoints: { entrances: 2, exits: 1 },
      } }),
    })
    expect(layoutResponse.status).toBe(200)
    const layout = (await layoutResponse.json()).data
    expect(layout.config).toMatchObject({ mapType: 'BUILDING', floorCount: 2, encounterScale: 'SINGLE', accessPoints: { entrances: 2 } })
    expect(layout.map).toMatchObject({ mapType: 'BUILDING', floorCount: 2, width: 30, height: 30 })
    const contentResponse = await fetch(resourceUrl, {
      method: 'PATCH', headers,
      body: JSON.stringify({ action: 'regenerate', scope: 'ENCOUNTERS', config: { mapType: 'FOREST' } }),
    })
    expect(contentResponse.status).toBe(400)
    const unchanged = (await fetch(resourceUrl, { headers }).then(response => response.json())).data
    expect(unchanged.config).toEqual(layout.config)
    expect(unchanged.map).toEqual(layout.map)
    const fullResponse = await fetch(resourceUrl, {
      method: 'PATCH', headers,
      body: JSON.stringify({ action: 'regenerate', scope: 'FULL', config: { mapType: 'FOREST', encounterScale: 'SINGLE' } }),
    })
    expect(fullResponse.status).toBe(200)
    const full = (await fullResponse.json()).data
    expect(full.config).toMatchObject({ mapType: 'FOREST', floorCount: 1, encounterScale: 'SINGLE' })
    expect(full.map).toMatchObject({ mapType: 'FOREST', floorCount: 1 })
    const persisted = (await fetch(resourceUrl, { headers }).then(response => response.json())).data
    expect(persisted.config).toEqual(full.config)
    expect(persisted.map).toEqual(full.map)
  })

  // Generate and edit a dungeon, preserve room links, and verify role restrictions.
  it('creates dungeon, generates/regenerates, and enforces viewer read-only', { timeout: 15_000 }, async () => {
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
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`,
      {
        method: 'PATCH',
        headers: {
          cookie: cookies.owner,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate',
          seed: 'fixed-seed-a',
        }),
      },
    )
    expect(generateResponse.status).toBe(200)
    const generatedPayload = await generateResponse.json()
    const generatedHash = generatedPayload.data.map.metadata.configHash

    const regenerateDoors = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`,
      {
        method: 'PATCH',
        headers: {
          cookie: cookies.owner,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'regenerate',
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
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/rooms/${roomRowId}`,
      {
        method: 'PATCH',
        headers: {
          cookie: cookies.owner,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'create-encounter' }),
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
    const renumberResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/map`,
      {
        method: 'PATCH',
        headers: { cookie: cookies.owner, 'content-type': 'application/json' },
        body: JSON.stringify({ actions: [{ type: 'RENUMBER_ROOMS', mode: 'AUTO' }] }),
      },
    )
    expect(renumberResponse.status).toBe(200)
    const retainedRoom = (db.query.campaignDungeonRoom.findFirst({ where: eq(tables.campaignDungeonRoom.id, roomRowId) }).sync() ?? null)
    expect(retainedRoom).toMatchObject({ name: 'Edited Room', gmNotes: 'Secret lever behind statue', state: 'EXPLORED' })
    const retainedLink = (db.query.campaignDungeonLink.findFirst({ where: and(eq(tables.campaignDungeonLink.dungeonId, dungeonId), eq(tables.campaignDungeonLink.targetId, encounterFromRoomPayload.data.encounterId)) }).sync() ?? null)
    expect(retainedLink?.roomId).toBe(roomRowId)

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
    expect(viewerPatchMap.status).toBe(403)

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
    expect(viewerPatch.status).toBe(403)

    const viewerRoomsResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}/rooms`, {
      headers: { cookie: cookies.viewer },
    })
    expect(viewerRoomsResponse.status).toBe(200)
    const viewerRoomsPayload = await viewerRoomsResponse.json()
    expect(viewerRoomsPayload.data[0].gmNotes).toBeNull()

    const ownerPublishResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'publish' }),
    })
    expect(ownerPublishResponse.status).toBe(200)
    const publishPayload = await ownerPublishResponse.json()
    expect(publishPayload.data.status).toBe('READY')

    const viewerUnpublishResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`,
      {
        method: 'PATCH',
        headers: {
          cookie: cookies.viewer,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'unpublish' }),
      },
    )
    expect(viewerUnpublishResponse.status).toBe(403)

    const ownerUnpublishResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`,
      {
        method: 'PATCH',
        headers: {
          cookie: cookies.owner,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'unpublish' }),
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

    const headers = { cookie: cookies.owner, 'content-type': 'application/json' }
    const resourceUrl = `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`
    const geometry = (await beforePatch.json()).data.rooms.find((room: { id: string }) => room.id === roomId)
    const roomRecords = (await fetch(`${resourceUrl}/rooms`, { headers }).then(response => response.json())).data
    const roomRecord = roomRecords.find((room: { roomNumber: number }) => room.roomNumber === geometry.roomNumber)
    const saveRoom = await fetch(`${resourceUrl}/rooms/${roomRecord.id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ description: 'Saved description', gmNotes: 'Saved notes', tags: ['reviewed'], state: 'EXPLORED' }),
    })
    expect(saveRoom.status).toBe(200)
    const createRoomLink = await fetch(`${resourceUrl}/links`, {
      method: 'POST', headers,
      body: JSON.stringify({ roomId: roomRecord.id, linkType: 'QUEST', targetId: 'snapshot-room-link' }),
    })
    expect(createRoomLink.status).toBe(200)
    const roomLinkId = (await createRoomLink.json()).data.id

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
    const restoredRecords = (await fetch(`${resourceUrl}/rooms`, { headers }).then(response => response.json())).data
    const restoredRecord = restoredRecords.find((room: { roomNumber: number }) => room.roomNumber === restoredRoom.roomNumber)
    expect(restoredRecord.id).not.toBe(roomRecord.id)
    expect(restoredRecord).toMatchObject({
      name: restoredRoom.label || `Room ${restoredRoom.roomNumber}`,
      description: null, gmNotes: null, playerNotes: null, readAloud: null,
      tags: [], state: 'UNSEEN',
      bounds: { x: 10, y: 10, width: restoredRoom.width, height: restoredRoom.height, floor: restoredRoom.floor ?? 0 },
    })
    const restoredLinks = (await fetch(`${resourceUrl}/links`, { headers }).then(response => response.json())).data
    expect(restoredLinks.find((link: { id: string }) => link.id === roomLinkId)).toMatchObject({ roomId: null, targetId: 'snapshot-room-link' })
  })

  it('labels and previews snapshots, undoes partial regeneration without losing room details, and prunes automatic snapshots', { timeout: 60_000 }, async () => {
    const headers = { cookie: cookies.owner, 'content-type': 'application/json' }
    const resourceUrl = `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`
    const data = async (response: Response) => {
      expect(response.status).toBe(200)
      return (await response.json()).data
    }

    const labelled = await data(await fetch(`${resourceUrl}/snapshots`, {
      method: 'POST', headers, body: JSON.stringify({ snapshotType: 'MANUAL', label: '  Favourite layout  ' }),
    }))
    expect(labelled).toMatchObject({ label: 'Favourite layout', mapType: 'DUNGEON', roomCount: expect.any(Number), floorCount: 1 })
    expect(labelled.map).toBeUndefined()
    const rename = (snapshotId: string, label: string | null) => fetch(`${resourceUrl}/snapshots/${snapshotId}`, {
      method: 'PATCH', headers, body: JSON.stringify({ label }),
    })
    expect((await data(await rename(labelled.id, 'Final layout'))).label).toBe('Final layout')
    expect((await data(await rename(labelled.id, null))).label).toBeNull()
    expect((await rename('missing-snapshot', 'Nope')).status).toBe(404)
    const viewerRename = await fetch(`${resourceUrl}/snapshots/${labelled.id}`, {
      method: 'PATCH', headers: { cookie: cookies.viewer, 'content-type': 'application/json' }, body: JSON.stringify({ label: 'Viewer' }),
    })
    expect(viewerRename.status).toBe(403)

    const withMaps = await data(await fetch(`${resourceUrl}/snapshots?include=map`, { headers }))
    expect(withMaps.find((snapshot: { id: string }) => snapshot.id === labelled.id).map.rooms).toHaveLength(labelled.roomCount)
    const viewerMaps = await data(await fetch(`${resourceUrl}/snapshots?include=map`, { headers: { cookie: cookies.viewer } }))
    expect(viewerMaps.every((snapshot: { map: { rooms: Array<{ isSecret: boolean }> } }) =>
      snapshot.map.rooms.every(room => !room.isSecret))).toBe(true)

    const [record] = await data(await fetch(`${resourceUrl}/rooms`, { headers }))
    await data(await fetch(`${resourceUrl}/rooms/${record.id}`, { method: 'PATCH', headers, body: JSON.stringify({ gmNotes: 'Keep me' }) }))
    const regenerated = await data(await fetch(resourceUrl, {
      method: 'PATCH', headers, body: JSON.stringify({ action: 'regenerate', scope: 'TRAPS', seed: 'undo-traps' }),
    }))
    expect(regenerated.previousSnapshotId).toEqual(expect.any(String))
    const undone = await data(await fetch(`${resourceUrl}/snapshots/${regenerated.previousSnapshotId}/restore`, { method: 'POST', headers }))
    expect(undone).toEqual({ restored: true, roomsReset: false })
    const keptRecords = await data(await fetch(`${resourceUrl}/rooms`, { headers }))
    expect(keptRecords.find((room: { id: string }) => room.id === record.id)).toMatchObject({ gmNotes: 'Keep me' })

    for (let index = 0; index < 21; index += 1) {
      await data(await fetch(resourceUrl, { method: 'PATCH', headers, body: JSON.stringify({ action: 'regenerate', scope: 'TRAPS' }) }))
    }
    const pruned = await data(await fetch(`${resourceUrl}/snapshots`, { headers }))
    expect(pruned.filter((snapshot: { snapshotType: string }) => snapshot.snapshotType === 'PRE_REGENERATE')).toHaveLength(20)
    expect(pruned.some((snapshot: { id: string }) => snapshot.id === labelled.id)).toBe(true)
  })

  // Render four export formats and round-trip imports through the real server.
  it('exports JSON/SVG/PNG/PDF, supports import, and rejects oversized import payloads', { timeout: 30_000 }, async () => {
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

    const exportDmResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'export',
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

    const smallDocument = structuredClone(dmDocument)
    smallDocument.dungeon.map = {
      ...dmDocument.dungeon.map,
      mapType: 'DUNGEON', floorCount: 1, floorLabels: undefined, width: 4, height: 4,
      rooms: [{ id: 'small-room', roomNumber: 1, x: 0, y: 0, width: 4, height: 4, isSecret: false }],
      corridors: [], doors: [], walls: [], zones: [], stairs: [], portals: [], flow: undefined,
      traps: [], encounters: [], treasures: [], dressing: [],
      terrain: [{ id: 'tree', kind: 'TREE', x: 0, y: 0, width: 1, height: 1, blocksSight: true }],
    }
    smallDocument.rooms = []
    smallDocument.links = []
    const smallImport = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons`, {
      method: 'POST', headers: { cookie: cookies.owner, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'import', source: smallDocument }),
    })
    expect(smallImport.status).toBe(200)
    const smallMapId = (await smallImport.json()).data.id
    try {
      for (const format of ['SVG', 'PNG', 'PDF']) {
        const response = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${smallMapId}`, {
          method: 'PATCH', headers: { cookie: cookies.owner, 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'export', format }),
        })
        expect(response.status, `small imported map ${format} export`).toBe(200)
        const { data } = await response.json()
        if (format === 'SVG') expect(data.content).toContain('data-layer="terrain-key"')
        if (format === 'PNG') {
          const image = await sharp(Buffer.from(data.content, 'base64')).metadata()
          expect([image.width, image.height]).toEqual([128, 128])
        }
        if (format === 'PDF') expect(Buffer.from(data.content, 'base64').toString('latin1')).toContain('%PDF-')
      }
    } finally {
      const deleted = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${smallMapId}`, {
        method: 'DELETE', headers: { cookie: cookies.owner },
      })
      expect(deleted.status).toBe(200)
    }

    const largeDocument = structuredClone(smallDocument)
    largeDocument.dungeon.map.width = 400
    largeDocument.dungeon.map.height = 400
    largeDocument.dungeon.map.terrain = []
    largeDocument.dungeon.map.rooms = Array.from({ length: 3000 }, (_, index) => ({
      id: `imported-room-${index + 1}`, roomNumber: index + 1,
      x: (index % 100) * 4, y: Math.floor(index / 100) * 4,
      width: 3, height: 3, isSecret: false,
    }))
    const largeImport = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons`, {
      method: 'POST', headers: { cookie: cookies.owner, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'import', source: largeDocument }),
    })
    expect(largeImport.status).toBe(200)
    const largeMapId = (await largeImport.json()).data.id
    try {
      const rooms = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${largeMapId}/rooms`, {
        headers: { cookie: cookies.owner },
      })
      expect(rooms.status).toBe(200)
      expect((await rooms.json()).data).toHaveLength(3000)
    } finally {
      const deleted = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${largeMapId}`, {
        method: 'DELETE', headers: { cookie: cookies.owner },
      })
      expect(deleted.status).toBe(200)
    }

    const exportPlayerResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'export',
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

    const exportSvgResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'export',
        format: 'SVG',
        playerSafe: true,
      }),
    })
    expect(exportSvgResponse.status).toBe(200)
    const exportSvgPayload = await exportSvgResponse.json()
    expect(exportSvgPayload.data.filename.endsWith('.svg')).toBe(true)
    expect((exportSvgPayload.data.content as string).startsWith('<?xml')).toBe(true)

    const exportPngResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'export',
        format: 'PNG',
        playerSafe: true,
      }),
    })
    expect(exportPngResponse.status).toBe(200)
    const exportPngPayload = await exportPngResponse.json()
    expect(exportPngPayload.data.filename.endsWith('.png')).toBe(true)
    expect(exportPngPayload.data.encoding).toBe('base64')
    expect(exportPngPayload.data.contentType).toBe('image/png')
    const pngBuffer = Buffer.from(exportPngPayload.data.content, 'base64')
    const pngMetadata = await sharp(pngBuffer).metadata()
    expect(pngMetadata.format).toBe('png')
    expect(pngMetadata.width).toBe(playerDocument.dungeon.map.width * playerDocument.dungeon.map.cellSize)
    expect(pngMetadata.height).toBe(playerDocument.dungeon.map.height * playerDocument.dungeon.map.cellSize)
    // Decode the full image and compare it with the player-safe SVG, not just its header.
    const pngPixels = await sharp(pngBuffer).ensureAlpha().raw().toBuffer()
    const svgPixels = await sharp(Buffer.from(exportSvgPayload.data.content)).ensureAlpha().raw().toBuffer()
    expect(pngPixels.equals(svgPixels)).toBe(true)

    const viewerPngResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`, {
      method: 'PATCH',
      headers: { cookie: cookies.viewer, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'export', format: 'PNG', playerSafe: false, includeGmLayer: true }),
    })
    expect(viewerPngResponse.status).toBe(200)
    const viewerPngPayload = await viewerPngResponse.json()
    const viewerPixels = await sharp(Buffer.from(viewerPngPayload.data.content, 'base64')).ensureAlpha().raw().toBuffer()
    expect(viewerPixels.equals(pngPixels)).toBe(true)

    const exportPdfResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'export',
        format: 'PDF',
        playerSafe: true,
      }),
    })
    expect(exportPdfResponse.status).toBe(200)
    const exportPdfPayload = await exportPdfResponse.json()
    expect(exportPdfPayload.data.filename.endsWith('.pdf')).toBe(true)
    expect(exportPdfPayload.data.encoding).toBe('base64')
    expect(exportPdfPayload.data.contentType).toBe('application/pdf')
    const pdfContent = Buffer.from(exportPdfPayload.data.content, 'base64').toString('latin1')
    expect(pdfContent.startsWith('%PDF-')).toBe(true)
    expect(pdfContent.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(pdfContent).toMatch(/\/Type\s*\/Page\b/)
    expect(pdfContent).toMatch(/\/Subtype\s*\/Image\b/)
    expect(pdfContent).toMatch(/\/BaseFont\s*\/Helvetica\b/)

    const viewerForcedSafeExportResponse = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/dungeons/${dungeonId}`,
      {
        method: 'PATCH',
        headers: {
          cookie: cookies.viewer,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'export',
          format: 'JSON',
          playerSafe: false,
        }),
      },
    )
    expect(viewerForcedSafeExportResponse.status).toBe(200)
    const viewerForcedSafeExportPayload = await viewerForcedSafeExportResponse.json()
    const viewerDocument = JSON.parse(viewerForcedSafeExportPayload.data.content as string)
    expect(viewerDocument.rooms.every((entry: { gmNotes: string | null }) => entry.gmNotes === null)).toBe(true)

    const importResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'import',
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
    const oversizedResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/dungeons`, {
      method: 'POST',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'import',
        ...oversizedPayload,
      }),
    })
    expect(oversizedResponse.status).toBe(413)
  })
})
