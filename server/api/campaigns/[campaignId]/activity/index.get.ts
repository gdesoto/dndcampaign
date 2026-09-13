import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { prisma } from '#server/db/prisma'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'campaign.read')

  const logs = await prisma.activityLog.findMany({
    where: {
      campaignId,
      scope: 'CAMPAIGN',
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: {
      id: true,
      action: true,
      summary: true,
      createdAt: true,
    },
  })

  return ok(
    logs.map((entry) => ({
      id: entry.id,
      action: entry.action,
      summary: entry.summary,
      createdAt: entry.createdAt.toISOString(),
    })),
  )
})
