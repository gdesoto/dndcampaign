import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'content.read')
  if (!authz.ok) {
    return authz.response
  }

  const milestones = await prisma.milestone.findMany({
    where: { campaignId },
    orderBy: [{ isComplete: 'asc' }, { createdAt: 'desc' }],
  })

  return ok(milestones)
})

