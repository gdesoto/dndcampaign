// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'

const prisma = createApiTestPrismaClient()
const hash = new Hash(new Scrypt())
const baseUrl = getApiTestBaseUrl()
const password = 'dmr5-campaign-requests-pass'

const users = {
  owner: { email: 'dmr5-req-owner@example.com', name: 'DMR5 Owner' },
  dm: { email: 'dmr5-req-dm@example.com', name: 'DMR5 Co-DM' },
  player: { email: 'dmr5-req-player@example.com', name: 'DMR5 Player' },
  viewer: { email: 'dmr5-req-viewer@example.com', name: 'DMR5 Viewer' },
  outsider: { email: 'dmr5-req-outsider@example.com', name: 'DMR5 Outsider' },
}

const userIds: Record<string, string> = {}
const cookies: Record<string, string> = {}
let campaignId = ''
let privateRequestId = ''
let publicRequestId = ''
let pendingEditRequestId = ''

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

describe('campaign requests API routes', () => {
  beforeAll(async () => {
    const passwordHash = await hash.make(password)

    for (const [key, user] of Object.entries(users)) {
      const created = await prisma.user.create({
        data: {
          email: user.email,
          name: user.name,
          passwordHash,
        },
        select: { id: true, email: true },
      })
      userIds[key] = created.id
    }

    const campaign = await prisma.campaign.create({
      data: {
        ownerId: userIds.owner,
        name: 'DMR5 Request API Campaign',
        members: {
          create: [
            {
              userId: userIds.owner,
              role: 'OWNER',
              invitedByUserId: userIds.owner,
              hasDmAccess: true,
            },
            {
              userId: userIds.dm,
              role: 'COLLABORATOR',
              invitedByUserId: userIds.owner,
              hasDmAccess: true,
            },
            {
              userId: userIds.player,
              role: 'COLLABORATOR',
              invitedByUserId: userIds.owner,
              hasDmAccess: false,
            },
            {
              userId: userIds.viewer,
              role: 'VIEWER',
              invitedByUserId: userIds.owner,
              hasDmAccess: false,
            },
          ],
        },
      },
      select: { id: true },
    })

    campaignId = campaign.id

    for (const [key, user] of Object.entries(users)) {
      cookies[key] = await loginAndGetCookie(user.email)
    }
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('enforces private visibility and membership access rules', async () => {
    const createPrivate = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests`, {
      method: 'POST',
      headers: {
        cookie: cookies.player,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'ITEM',
        visibility: 'PRIVATE',
        title: 'Rare component stash',
        description: 'Need an expensive spell component for next arc.',
      }),
    })
    expect(createPrivate.status).toBe(200)
    const createPrivatePayload = await createPrivate.json()
    privateRequestId = createPrivatePayload.data.id

    const playerList = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests?mine=true`, {
      headers: { cookie: cookies.player },
    })
    expect(playerList.status).toBe(200)
    const playerListPayload = await playerList.json()
    expect(playerListPayload.data.items.some((entry: { id: string }) => entry.id === privateRequestId)).toBe(true)

    const viewerList = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests`, {
      headers: { cookie: cookies.viewer },
    })
    expect(viewerList.status).toBe(200)
    const viewerListPayload = await viewerList.json()
    expect(viewerListPayload.data.items.some((entry: { id: string }) => entry.id === privateRequestId)).toBe(false)

    const dmList = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests?moderationQueue=true`, {
      headers: { cookie: cookies.dm },
    })
    expect(dmList.status).toBe(200)
    const dmListPayload = await dmList.json()
    expect(dmListPayload.data.items.some((entry: { id: string }) => entry.id === privateRequestId)).toBe(true)

    const viewerDetail = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests/${privateRequestId}`, {
      headers: { cookie: cookies.viewer },
    })
    expect(viewerDetail.status).toBe(404)

    const dmDetail = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests/${privateRequestId}`, {
      headers: { cookie: cookies.dm },
    })
    expect(dmDetail.status).toBe(200)

    const outsiderList = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests`, {
      headers: { cookie: cookies.outsider },
    })
    expect(outsiderList.status).toBe(403)
  })

  it('supports voting, pending-only creator actions, moderation, and list filters', async () => {
    const createPublicByDm = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests`, {
      method: 'POST',
      headers: {
        cookie: cookies.dm,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'PLOT_POINT',
        visibility: 'PUBLIC',
        title: 'Run a city intrigue arc',
        description: 'Players vote if they want a politics-heavy arc.',
      }),
    })
    expect(createPublicByDm.status).toBe(200)
    const createPublicPayload = await createPublicByDm.json()
    publicRequestId = createPublicPayload.data.id

    const playerVote = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests/${publicRequestId}/votes`, {
      method: 'POST',
      headers: { cookie: cookies.player },
    })
    expect(playerVote.status).toBe(200)
    const playerVotePayload = await playerVote.json()
    expect(playerVotePayload.data.voteCount).toBe(1)

    const playerVoteReplay = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests/${publicRequestId}/votes`, {
      method: 'POST',
      headers: { cookie: cookies.player },
    })
    expect(playerVoteReplay.status).toBe(200)
    const playerVoteReplayPayload = await playerVoteReplay.json()
    expect(playerVoteReplayPayload.data.voteCount).toBe(1)

    const dmVote = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests/${publicRequestId}/votes`, {
      method: 'POST',
      headers: { cookie: cookies.dm },
    })
    expect(dmVote.status).toBe(200)
    const dmVotePayload = await dmVote.json()
    expect(dmVotePayload.data.voteCount).toBe(2)

    const removePlayerVote = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests/${publicRequestId}/votes/mine`, {
      method: 'DELETE',
      headers: { cookie: cookies.player },
    })
    expect(removePlayerVote.status).toBe(200)
    const removePlayerVotePayload = await removePlayerVote.json()
    expect(removePlayerVotePayload.data.voteCount).toBe(1)

    const playerDecisionAttempt = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests/${publicRequestId}/decision`, {
      method: 'POST',
      headers: {
        cookie: cookies.player,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        decision: 'APPROVED',
        decisionNote: 'Trying without DM access',
      }),
    })
    expect(playerDecisionAttempt.status).toBe(403)

    const dmDecision = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests/${publicRequestId}/decision`, {
      method: 'POST',
      headers: {
        cookie: cookies.dm,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        decision: 'APPROVED',
        decisionNote: 'Approved for next major story beat.',
      }),
    })
    expect(dmDecision.status).toBe(200)
    const dmDecisionPayload = await dmDecision.json()
    expect(dmDecisionPayload.data.status).toBe('APPROVED')
    expect(dmDecisionPayload.data.decisionNote).toContain('Approved')

    const voteAfterApproval = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests/${publicRequestId}/votes`, {
      method: 'POST',
      headers: { cookie: cookies.viewer },
    })
    expect(voteAfterApproval.status).toBe(409)

    const createPendingForEdit = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests`, {
      method: 'POST',
      headers: {
        cookie: cookies.player,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'ITEM',
        visibility: 'PUBLIC',
        title: 'Custom potion ingredients',
        description: 'Ask for rare ingredients to craft potions.',
      }),
    })
    expect(createPendingForEdit.status).toBe(200)
    const createPendingPayload = await createPendingForEdit.json()
    pendingEditRequestId = createPendingPayload.data.id

    const creatorPatch = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests/${pendingEditRequestId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.player,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Custom potion ingredients (revised)',
      }),
    })
    expect(creatorPatch.status).toBe(200)
    const creatorPatchPayload = await creatorPatch.json()
    expect(creatorPatchPayload.data.title).toContain('revised')

    const nonCreatorPatch = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests/${pendingEditRequestId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.dm,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'DM tries to edit',
      }),
    })
    expect(nonCreatorPatch.status).toBe(403)

    const creatorCancel = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests/${pendingEditRequestId}/cancel`, {
      method: 'POST',
      headers: { cookie: cookies.player },
    })
    expect(creatorCancel.status).toBe(200)
    const creatorCancelPayload = await creatorCancel.json()
    expect(creatorCancelPayload.data.status).toBe('CANCELED')

    const dmDecisionCanceled = await fetch(`${baseUrl}/api/campaigns/${campaignId}/requests/${pendingEditRequestId}/decision`, {
      method: 'POST',
      headers: {
        cookie: cookies.dm,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        decision: 'DENIED',
      }),
    })
    expect(dmDecisionCanceled.status).toBe(409)

    const pagedList = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/requests?page=1&pageSize=1&status=PENDING`,
      {
        headers: { cookie: cookies.dm },
      },
    )
    expect(pagedList.status).toBe(200)
    const pagedPayload = await pagedList.json()
    expect(pagedPayload.data.pagination.page).toBe(1)
    expect(pagedPayload.data.pagination.pageSize).toBe(1)
    expect(pagedPayload.data.pagination.total).toBeGreaterThanOrEqual(1)
  })
})
