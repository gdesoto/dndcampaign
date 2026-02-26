// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'

const prisma = createApiTestPrismaClient()
const hash = new Hash(new Scrypt())
const baseUrl = getApiTestBaseUrl()
const password = 'cj6-journal-pass-12345'

const users = {
  owner: { email: 'cj6-owner@example.com', name: 'CJ6 Owner' },
  dm: { email: 'cj6-dm@example.com', name: 'CJ6 Co-DM' },
  player: { email: 'cj6-player@example.com', name: 'CJ6 Player' },
  viewer: { email: 'cj6-viewer@example.com', name: 'CJ6 Viewer' },
  outsider: { email: 'cj6-outsider@example.com', name: 'CJ6 Outsider' },
}

const userIds: Record<string, string> = {}
const cookies: Record<string, string> = {}
let campaignId = ''
let otherCampaignSessionId = ''
let sessionOneId = ''
let sessionTwoId = ''
let relicGlossaryId = ''

const wait = (ms: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))

const loginAndGetCookie = async (email: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.90',
      },
      body: JSON.stringify({ email, password }),
    })

    if (response.status === 429) {
      await wait(250)
      continue
    }

    expect(response.status).toBe(200)
    const rawCookie = response.headers.get('set-cookie') || ''
    const match = rawCookie.match(/nuxt-session=[^;]+/)
    return match?.[0] || ''
  }

  throw new Error(`Unable to authenticate ${email} due to rate limiting`)
}

describe('campaign journal API routes', () => {
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
        name: 'CJ6 Journal Campaign',
        system: 'D&D 5e',
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

    const otherCampaign = await prisma.campaign.create({
      data: {
        ownerId: userIds.outsider,
        name: 'CJ6 Other Campaign',
        members: {
          create: [
            {
              userId: userIds.outsider,
              role: 'OWNER',
              invitedByUserId: userIds.outsider,
              hasDmAccess: true,
            },
          ],
        },
      },
      select: { id: true },
    })

    const [sessionOne, sessionTwo, otherSession] = await prisma.$transaction([
      prisma.session.create({
        data: {
          campaignId,
          title: 'Session One',
          sessionNumber: 1,
          notes: 'CJ6 notes',
        },
        select: { id: true },
      }),
      prisma.session.create({
        data: {
          campaignId,
          title: 'Session Two',
          sessionNumber: 2,
          notes: 'CJ6 notes second',
        },
        select: { id: true },
      }),
      prisma.session.create({
        data: {
          campaignId: otherCampaign.id,
          title: 'Foreign Session',
          sessionNumber: 1,
        },
        select: { id: true },
      }),
    ])
    sessionOneId = sessionOne.id
    sessionTwoId = sessionTwo.id
    otherCampaignSessionId = otherSession.id

    const relicGlossary = await prisma.glossaryEntry.create({
      data: {
        campaignId,
        type: 'ITEM',
        name: 'Ancient Relic',
        description: 'A mysterious relic tied to the first age.',
      },
      select: { id: true },
    })
    relicGlossaryId = relicGlossary.id

    await prisma.glossaryEntry.create({
      data: {
        campaignId,
        type: 'LOCATION',
        name: 'Grey Harbor',
        description: 'A storm-worn city on the western coast.',
      },
    })

    for (const [key, user] of Object.entries(users)) {
      cookies[key] = await loginAndGetCookie(user.email)
    }
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('enforces visibility matrix and moderation write permissions', async () => {
    const createMyselfRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries`, {
      method: 'POST',
      headers: {
        cookie: cookies.player,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Private Thoughts',
        contentMarkdown: 'Only I should read this. #private',
        visibility: 'MYSELF',
      }),
    })
    expect(createMyselfRes.status).toBe(200)
    const createMyselfPayload = await createMyselfRes.json()
    const myselfEntryId = createMyselfPayload.data.id as string

    const createDmRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries`, {
      method: 'POST',
      headers: {
        cookie: cookies.player,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'DM Strategy',
        contentMarkdown: 'DM planning note #strategy',
        visibility: 'DM',
      }),
    })
    expect(createDmRes.status).toBe(200)
    const createDmPayload = await createDmRes.json()
    const dmEntryId = createDmPayload.data.id as string

    const createCampaignRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries`, {
      method: 'POST',
      headers: {
        cookie: cookies.player,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Campaign Recap',
        contentMarkdown: 'Shared with everyone #recap',
        visibility: 'CAMPAIGN',
      }),
    })
    expect(createCampaignRes.status).toBe(200)
    const createCampaignPayload = await createCampaignRes.json()
    const campaignEntryId = createCampaignPayload.data.id as string

    const playerMineRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries?mine=true`, {
      headers: { cookie: cookies.player },
    })
    expect(playerMineRes.status).toBe(200)
    const playerMinePayload = await playerMineRes.json()
    const playerIds = (playerMinePayload.data.items as Array<{ id: string }>).map((entry) => entry.id)
    expect(playerIds).toContain(myselfEntryId)
    expect(playerIds).toContain(dmEntryId)
    expect(playerIds).toContain(campaignEntryId)

    const viewerListRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries`, {
      headers: { cookie: cookies.viewer },
    })
    expect(viewerListRes.status).toBe(200)
    const viewerListPayload = await viewerListRes.json()
    const viewerIds = (viewerListPayload.data.items as Array<{ id: string }>).map((entry) => entry.id)
    expect(viewerIds).toContain(campaignEntryId)
    expect(viewerIds).not.toContain(myselfEntryId)
    expect(viewerIds).not.toContain(dmEntryId)

    const dmVisibleRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries?dmVisible=true`, {
      headers: { cookie: cookies.dm },
    })
    expect(dmVisibleRes.status).toBe(200)
    const dmVisiblePayload = await dmVisibleRes.json()
    const dmVisibleIds = (dmVisiblePayload.data.items as Array<{ id: string }>).map((entry) => entry.id)
    expect(dmVisibleIds).toContain(dmEntryId)
    expect(dmVisibleIds).toContain(campaignEntryId)
    expect(dmVisibleIds).not.toContain(myselfEntryId)

    const viewerDmDetail = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries/${dmEntryId}`, {
      headers: { cookie: cookies.viewer },
    })
    expect(viewerDmDetail.status).toBe(404)

    const dmDmDetail = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries/${dmEntryId}`, {
      headers: { cookie: cookies.dm },
    })
    expect(dmDmDetail.status).toBe(200)
    const dmDmDetailPayload = await dmDmDetail.json()
    expect(dmDmDetailPayload.data.canEdit).toBe(true)
    expect(dmDmDetailPayload.data.canDelete).toBe(true)

    const viewerPatchRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries/${campaignEntryId}`,
      {
        method: 'PATCH',
        headers: {
          cookie: cookies.viewer,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: 'Viewer should not edit this' }),
      }
    )
    expect(viewerPatchRes.status).toBe(403)

    const dmPatchRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries/${dmEntryId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.dm,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: 'DM Strategy (reviewed by Co-DM)' }),
    })
    expect(dmPatchRes.status).toBe(200)
    const dmPatchPayload = await dmPatchRes.json()
    expect(dmPatchPayload.data.title).toContain('reviewed by Co-DM')

    const dmDeleteRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries/${dmEntryId}`, {
      method: 'DELETE',
      headers: { cookie: cookies.dm },
    })
    expect(dmDeleteRes.status).toBe(200)

    const deletedDetailRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries/${dmEntryId}`,
      {
        headers: { cookie: cookies.player },
      }
    )
    expect(deletedDetailRes.status).toBe(404)

    const outsiderListRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries`, {
      headers: { cookie: cookies.outsider },
    })
    expect(outsiderListRes.status).toBe(403)
  })

  it('validates multi-session links and search over title/body/tags', async () => {
    const createRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries`, {
      method: 'POST',
      headers: {
        cookie: cookies.player,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Harbor Investigation Notes',
        contentMarkdown: 'KeywordRaven appears here. #Mystery #mystery [[Ancient Relic]]',
        visibility: 'CAMPAIGN',
        sessionIds: [sessionOneId, sessionTwoId],
      }),
    })
    expect(createRes.status).toBe(200)
    const createPayload = await createRes.json()
    const created = createPayload.data as {
      id: string
      sessions: Array<{ sessionId: string }>
      tags: Array<{ tagType: string; normalizedLabel: string; glossaryEntryId: string | null }>
    }
    expect(created.sessions).toHaveLength(2)
    expect(created.sessions.map((session) => session.sessionId).sort()).toEqual(
      [sessionOneId, sessionTwoId].sort()
    )
    expect(
      created.tags.some((tag) => tag.tagType === 'CUSTOM' && tag.normalizedLabel === 'mystery')
    ).toBe(true)
    expect(
      created.tags.some((tag) => tag.tagType === 'GLOSSARY' && tag.glossaryEntryId === relicGlossaryId)
    ).toBe(true)

    const invalidSessionRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries`, {
      method: 'POST',
      headers: {
        cookie: cookies.player,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Invalid Link',
        contentMarkdown: 'Trying to link foreign session',
        visibility: 'CAMPAIGN',
        sessionIds: [otherCampaignSessionId],
      }),
    })
    expect(invalidSessionRes.status).toBe(400)

    const searchTitleBodyRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries?search=KeywordRaven`,
      {
        headers: { cookie: cookies.viewer },
      }
    )
    expect(searchTitleBodyRes.status).toBe(200)
    const searchTitleBodyPayload = await searchTitleBodyRes.json()
    expect(
      (searchTitleBodyPayload.data.items as Array<{ id: string }>).some((entry) => entry.id === created.id)
    ).toBe(true)

    const tagFilterRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries?tag=mystery`, {
      headers: { cookie: cookies.viewer },
    })
    expect(tagFilterRes.status).toBe(200)
    const tagFilterPayload = await tagFilterRes.json()
    expect(
      (tagFilterPayload.data.items as Array<{ id: string }>).some((entry) => entry.id === created.id)
    ).toBe(true)

    const sessionFilterRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries?sessionId=${sessionTwoId}`,
      {
        headers: { cookie: cookies.viewer },
      }
    )
    expect(sessionFilterRes.status).toBe(200)
    const sessionFilterPayload = await sessionFilterRes.json()
    expect(
      (sessionFilterPayload.data.items as Array<{ id: string }>).some((entry) => entry.id === created.id)
    ).toBe(true)
  })

  it('enforces discoverable holder editing/delete rules and archived list filters', async () => {
    const createRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries`, {
      method: 'POST',
      headers: {
        cookie: cookies.dm,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Discoverable Letter',
        contentMarkdown: 'A sealed letter for a player.',
        visibility: 'DM',
      }),
    })
    expect(createRes.status).toBe(200)
    const createPayload = await createRes.json()
    const entryId = createPayload.data.id as string

    await prisma.campaignJournalEntry.update({
      where: { id: entryId },
      data: {
        isDiscoverable: true,
        holderUserId: userIds.player,
        discoveredAt: new Date(),
        discoveredByUserId: userIds.dm,
      },
    })

    const holderVisibilityPatchRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}`,
      {
        method: 'PATCH',
        headers: {
          cookie: cookies.player,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          visibility: 'CAMPAIGN',
        }),
      }
    )
    expect(holderVisibilityPatchRes.status).toBe(200)

    const holderContentPatchRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.player,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Player should not edit discoverable content',
      }),
    })
    expect(holderContentPatchRes.status).toBe(403)

    const holderDeleteRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}`, {
      method: 'DELETE',
      headers: {
        cookie: cookies.player,
      },
    })
    expect(holderDeleteRes.status).toBe(403)

    await prisma.campaignJournalEntry.update({
      where: { id: entryId },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedByUserId: userIds.player,
      },
    })

    const defaultListRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries`, {
      headers: { cookie: cookies.dm },
    })
    expect(defaultListRes.status).toBe(200)
    const defaultListPayload = await defaultListRes.json()
    expect(
      (defaultListPayload.data.items as Array<{ id: string }>).some((item) => item.id === entryId)
    ).toBe(false)

    const includeArchivedRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries?includeArchived=true`,
      {
        headers: { cookie: cookies.dm },
      }
    )
    expect(includeArchivedRes.status).toBe(200)
    const includeArchivedPayload = await includeArchivedRes.json()
    expect(
      (includeArchivedPayload.data.items as Array<{ id: string }>).some((item) => item.id === entryId)
    ).toBe(true)

    const archivedOnlyRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries?archived=true`, {
      headers: { cookie: cookies.dm },
    })
    expect(archivedOnlyRes.status).toBe(200)
    const archivedOnlyPayload = await archivedOnlyRes.json()
    expect(
      (archivedOnlyPayload.data.items as Array<{ id: string }>).some((item) => item.id === entryId)
    ).toBe(true)

    const dmDeleteRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}`, {
      method: 'DELETE',
      headers: {
        cookie: cookies.dm,
      },
    })
    expect(dmDeleteRes.status).toBe(200)
  })

  it('supports discoverable endpoints for discover/transfer/archive/history/notifications', async () => {
    const memberOptionsRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-member-options`, {
      headers: {
        cookie: cookies.player,
      },
    })
    expect(memberOptionsRes.status).toBe(200)

    const createRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries`, {
      method: 'POST',
      headers: {
        cookie: cookies.dm,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Encoded Dispatch',
        contentMarkdown: 'Transfer target note',
        visibility: 'DM',
      }),
    })
    expect(createRes.status).toBe(200)
    const createPayload = await createRes.json()
    const entryId = createPayload.data.id as string

    const playerDiscoverablePatchRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}/discoverable`,
      {
        method: 'PATCH',
        headers: {
          cookie: cookies.player,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          isDiscoverable: true,
          holderUserId: userIds.player,
          visibility: 'DM',
        }),
      }
    )
    expect(playerDiscoverablePatchRes.status).toBe(403)

    const dmDiscoverablePatchRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}/discoverable`,
      {
        method: 'PATCH',
        headers: {
          cookie: cookies.dm,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          isDiscoverable: true,
          holderUserId: userIds.player,
          visibility: 'DM',
        }),
      }
    )
    expect(dmDiscoverablePatchRes.status).toBe(200)

    const holderTransferRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}/transfer`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.player,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          toHolderUserId: userIds.viewer,
          visibility: 'CAMPAIGN',
        }),
      }
    )
    expect(holderTransferRes.status).toBe(200)

    const oldHolderTransferRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}/transfer`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.player,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          toHolderUserId: userIds.player,
        }),
      }
    )
    expect(oldHolderTransferRes.status).toBe(403)

    const dmDiscoverRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}/discover`, {
      method: 'POST',
      headers: {
        cookie: cookies.dm,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        holderUserId: userIds.player,
        visibility: 'DM',
      }),
    })
    expect(dmDiscoverRes.status).toBe(200)

    const viewerTransferRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}/transfer`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.viewer,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          toHolderUserId: userIds.player,
        }),
      }
    )
    expect(viewerTransferRes.status).toBe(404)

    const holderArchiveRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}/archive`, {
      method: 'POST',
      headers: {
        cookie: cookies.player,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    expect(holderArchiveRes.status).toBe(200)

    const holderUnarchiveRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}/unarchive`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.player,
        },
      }
    )
    expect(holderUnarchiveRes.status).toBe(200)

    const historyRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}/history`, {
      headers: {
        cookie: cookies.player,
      },
    })
    expect(historyRes.status).toBe(200)
    const historyPayload = await historyRes.json()
    const historyActions = (historyPayload.data.items as Array<{ action: string }>).map((item) => item.action)
    expect(historyActions).toContain('DISCOVERED')
    expect(historyActions).toContain('TRANSFERRED')
    expect(historyActions).toContain('ARCHIVED')
    expect(historyActions).toContain('UNARCHIVED')

    const viewerHistoryRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries/${entryId}/history`,
      {
        headers: {
          cookie: cookies.viewer,
        },
      }
    )
    expect(viewerHistoryRes.status).toBe(404)

    const notificationsRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-notifications`, {
      headers: {
        cookie: cookies.player,
      },
    })
    expect(notificationsRes.status).toBe(200)
    const notificationsPayload = await notificationsRes.json()
    const notificationTypes = (notificationsPayload.data.items as Array<{ type: string }>).map(
      (item) => item.type
    )
    expect(notificationTypes).toContain('DISCOVERED')
    expect(notificationTypes).toContain('TRANSFERRED')
    expect(notificationTypes).toContain('ARCHIVED')
    expect(notificationTypes).toContain('UNARCHIVED')

    const outsiderNotificationsRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-notifications`, {
      headers: {
        cookie: cookies.outsider,
      },
    })
    expect(outsiderNotificationsRes.status).toBe(403)
  })

  it('retains orphaned glossary labels after glossary deletion', async () => {
    const createRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries`, {
      method: 'POST',
      headers: {
        cookie: cookies.player,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Relic Cross Reference',
        contentMarkdown: 'Tag this [[Ancient Relic]] for later.',
        visibility: 'CAMPAIGN',
      }),
    })
    expect(createRes.status).toBe(200)

    await prisma.glossaryEntry.delete({
      where: { id: relicGlossaryId },
    })

    const tagsRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-tags?type=GLOSSARY`, {
      headers: { cookie: cookies.player },
    })
    expect(tagsRes.status).toBe(200)
    const tagsPayload = await tagsRes.json()
    const orphaned = (tagsPayload.data.items as Array<{
      displayLabel: string
      glossaryEntryId: string | null
      isOrphanedGlossaryTag: boolean
    }>).find((item) => item.displayLabel === 'Ancient Relic')

    expect(orphaned).toBeTruthy()
    expect(orphaned?.glossaryEntryId).toBe(null)
    expect(orphaned?.isOrphanedGlossaryTag).toBe(true)
  })

  it('gates public journal with showJournal and only returns campaign-visible entries', async () => {
    const settingsRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access`, {
      headers: { cookie: cookies.owner },
    })
    expect(settingsRes.status).toBe(200)
    const settingsPayload = await settingsRes.json()
    const publicSlug = settingsPayload.data.publicSlug as string

    const createPublicCampaignEntryRes = await fetch(
      `${baseUrl}/api/campaigns/${campaignId}/journal-entries`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.player,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Public Chronicle',
          contentMarkdown: 'Chronicle text for visitors #chronicle',
          visibility: 'CAMPAIGN',
        }),
      }
    )
    expect(createPublicCampaignEntryRes.status).toBe(200)
    const createPublicCampaignEntryPayload = await createPublicCampaignEntryRes.json()
    const publicCampaignEntryId = createPublicCampaignEntryPayload.data.id as string

    const createPublicDmEntryRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/journal-entries`, {
      method: 'POST',
      headers: {
        cookie: cookies.player,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'DM Hidden Chronicle',
        contentMarkdown: 'This must never be public.',
        visibility: 'DM',
      }),
    })
    expect(createPublicDmEntryRes.status).toBe(200)
    const createPublicDmEntryPayload = await createPublicDmEntryRes.json()
    const publicDmEntryId = createPublicDmEntryPayload.data.id as string

    const enableWithoutJournalRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        isEnabled: true,
        showJournal: false,
      }),
    })
    expect(enableWithoutJournalRes.status).toBe(200)

    const deniedPublicRes = await fetch(`${baseUrl}/api/public/campaigns/${publicSlug}/journal-entries`)
    expect(deniedPublicRes.status).toBe(404)
    const deniedPublicPayload = await deniedPublicRes.json()
    expect(deniedPublicPayload.error.code).toBe('PUBLIC_SECTION_NOT_AVAILABLE')

    const enableJournalRes = await fetch(`${baseUrl}/api/campaigns/${campaignId}/public-access`, {
      method: 'PATCH',
      headers: {
        cookie: cookies.owner,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        isEnabled: true,
        showJournal: true,
      }),
    })
    expect(enableJournalRes.status).toBe(200)

    const publicListRes = await fetch(
      `${baseUrl}/api/public/campaigns/${publicSlug}/journal-entries?search=Chronicle`
    )
    expect(publicListRes.status).toBe(200)
    const publicListPayload = await publicListRes.json()
    const items = publicListPayload.data.items as Array<{ id: string; visibility: string }>
    expect(items.some((item) => item.id === publicCampaignEntryId)).toBe(true)
    expect(items.some((item) => item.id === publicDmEntryId)).toBe(false)
    expect(items.every((item) => item.visibility === 'CAMPAIGN')).toBe(true)
  })
})
