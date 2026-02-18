import 'dotenv/config'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

export async function verifyCampaignOwnerMemberships({ prisma, logger = console } = {}) {
  const db = prisma || new PrismaClient()

  try {
    const campaigns = await db.campaign.findMany({
      select: {
        id: true,
        name: true,
        ownerId: true,
        members: {
          where: { role: 'OWNER' },
          select: { userId: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const missingOwnerMemberships = campaigns
      .filter((campaign) => !campaign.members.some((member) => member.userId === campaign.ownerId))
      .map((campaign) => ({
        campaignId: campaign.id,
        campaignName: campaign.name,
        ownerId: campaign.ownerId,
      }))

    const summary = {
      campaignsScanned: campaigns.length,
      missingCount: missingOwnerMemberships.length,
      missingOwnerMemberships,
    }

    logger.info('[um2] verify-campaign-owner-memberships summary')
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
  verifyCampaignOwnerMemberships()
    .then((summary) => {
      if (summary.missingCount > 0) {
        process.exitCode = 1
      }
    })
    .catch((error) => {
      console.error('[um2] verify-campaign-owner-memberships failed')
      console.error(error)
      process.exit(1)
    })
}
