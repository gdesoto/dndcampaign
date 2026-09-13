import { prisma } from '#server/db/prisma'
import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { campaignUpdateSchema } from '#shared/schemas/campaign'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')
  const parsed = await validateBody(event, campaignUpdateSchema, 'Invalid campaign payload')
  await requireCampaignPermission(event, campaignId, 'campaign.settings.manage')

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: parsed,
  })

  return ok(updated)
})

