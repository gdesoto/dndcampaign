// @vitest-environment node
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTestDbContext } from '../scripts/test-db-utils.mjs'
import { backfillCampaignOwnerMemberships } from '../../scripts/user-management/backfill-campaign-owner-memberships.mjs'
import { verifyCampaignOwnerMemberships } from '../../scripts/user-management/verify-campaign-owner-memberships.mjs'

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const db = createTestDbContext({
  rootDir,
  prefix: 'unit-um2',
  sessionPassword: 'unit-um2-session-password-1234567890-abcdefghijklmnopqrstuvwxyz',
})

const prisma = new PrismaClient({ datasourceUrl: db.dbUrl })
const silentLogger = { info: () => {} }

describe('user management UM-2 membership data layer', () => {
  beforeAll(() => {
    db.prepare({ migrate: true, seed: false, stdio: 'pipe' })
  }, 120_000)

  afterAll(async () => {
    await prisma.$disconnect()
    await db.cleanup()
  })

  it('detects campaigns missing owner membership rows', async () => {
    const owner = await prisma.user.create({
      data: {
        email: 'um2-owner-missing@example.com',
        name: 'UM2 Owner Missing',
      },
      select: { id: true },
    })

    const campaign = await prisma.campaign.create({
      data: {
        ownerId: owner.id,
        name: 'Missing Membership Campaign',
      },
      select: { id: true },
    })

    const summary = await verifyCampaignOwnerMemberships({
      prisma,
      logger: silentLogger,
    })

    const missingCampaign = summary.missingOwnerMemberships.find(
      (item) => item.campaignId === campaign.id
    )

    expect(summary.missingCount).toBeGreaterThan(0)
    expect(missingCampaign?.ownerId).toBe(owner.id)
  })

  it('backfills owner memberships and is idempotent', async () => {
    const owner = await prisma.user.create({
      data: {
        email: 'um2-owner-backfill@example.com',
        name: 'UM2 Owner Backfill',
      },
      select: { id: true },
    })

    const campaign = await prisma.campaign.create({
      data: {
        ownerId: owner.id,
        name: 'Backfill Membership Campaign',
      },
      select: { id: true },
    })

    await prisma.campaignMember.create({
      data: {
        campaignId: campaign.id,
        userId: owner.id,
        role: 'VIEWER',
        invitedByUserId: owner.id,
      },
    })

    const firstBackfill = await backfillCampaignOwnerMemberships({
      prisma,
      logger: silentLogger,
    })
    expect(firstBackfill.membershipsUpdatedToOwner).toBeGreaterThan(0)

    const ownerMembership = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId: campaign.id,
          userId: owner.id,
        },
      },
      select: { role: true },
    })
    expect(ownerMembership?.role).toBe('OWNER')

    const secondBackfill = await backfillCampaignOwnerMemberships({
      prisma,
      logger: silentLogger,
    })
    expect(secondBackfill.membershipsCreated).toBe(0)
    expect(secondBackfill.membershipsUpdatedToOwner).toBe(0)
  })
})
