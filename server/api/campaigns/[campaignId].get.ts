import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')
  await requireCampaignPermission(event, campaignId, 'campaign.read')

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  })

  if (!campaign) {
    throw apiError(404, 'NOT_FOUND', 'Campaign not found')
  }

  return ok(campaign)
})

