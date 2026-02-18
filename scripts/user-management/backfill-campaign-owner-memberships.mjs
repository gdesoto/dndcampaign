import 'dotenv/config'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

export async function backfillCampaignOwnerMemberships({
  prisma,
  dryRun = false,
  logger = console,
} = {}) {
  const db = prisma || new PrismaClient()
  const summary = {
    campaignsScanned: 0,
    membershipsCreated: 0,
    membershipsUpdatedToOwner: 0,
    membershipsUnchanged: 0,
    dryRun,
  }

  try {
    const campaigns = await db.campaign.findMany({
      select: {
        id: true,
        ownerId: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    summary.campaignsScanned = campaigns.length

    for (const campaign of campaigns) {
      const existingMembership = await db.campaignMember.findUnique({
        where: {
          campaignId_userId: {
            campaignId: campaign.id,
            userId: campaign.ownerId,
          },
        },
        select: {
          id: true,
          role: true,
        },
      })

      if (!existingMembership) {
        summary.membershipsCreated += 1
        if (!dryRun) {
          await db.campaignMember.create({
            data: {
              campaignId: campaign.id,
              userId: campaign.ownerId,
              role: 'OWNER',
              invitedByUserId: campaign.ownerId,
            },
          })
        }
        continue
      }

      if (existingMembership.role !== 'OWNER') {
        summary.membershipsUpdatedToOwner += 1
        if (!dryRun) {
          await db.campaignMember.update({
            where: { id: existingMembership.id },
            data: {
              role: 'OWNER',
              invitedByUserId: campaign.ownerId,
            },
          })
        }
        continue
      }

      summary.membershipsUnchanged += 1
    }

    logger.info('[um2] backfill-campaign-owner-memberships summary')
    logger.info(JSON.stringify(summary, null, 2))
    return summary
  } finally {
    if (!prisma) {
      await db.$disconnect()
    }
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const dryRun = process.argv.includes('--dry-run')

  backfillCampaignOwnerMemberships({ dryRun }).catch((error) => {
    console.error('[um2] backfill-campaign-owner-memberships failed')
    console.error(error)
    process.exit(1)
  })
}
