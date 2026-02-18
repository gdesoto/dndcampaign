import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { campaignUpdateSchema } from '#shared/schemas/campaign'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId

  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const parsed = await readValidatedBodySafe(event, campaignUpdateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid campaign payload', parsed.fieldErrors)
  }

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

