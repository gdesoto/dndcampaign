import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { campaignUpdateSchema } from '#shared/schemas/campaign'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId

  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const parsed = await validateBody(event, campaignUpdateSchema, 'Invalid campaign payload')
  if (!parsed.ok) return parsed.response

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.settings.manage')
  if (!authz.ok) {
    return authz.response
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: parsed.data,
  })

  return ok(updated)
})

