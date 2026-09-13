import { prisma } from '#server/db/prisma'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.read')

  const milestones = await prisma.milestone.findMany({
    where: { campaignId },
    orderBy: [{ isComplete: 'asc' }, { createdAt: 'desc' }],
  })

  return ok(milestones)
})

