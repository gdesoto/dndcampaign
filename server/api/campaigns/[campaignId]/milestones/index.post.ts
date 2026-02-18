import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { milestoneCreateSchema } from '#shared/schemas/milestone'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'content.write')
  if (!authz.ok) {
    return authz.response
  }

  const parsed = await readValidatedBodySafe(event, milestoneCreateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid milestone payload', parsed.fieldErrors)
  }

  const milestone = await prisma.milestone.create({
    data: {
      campaignId,
      title: parsed.data.title,
      description: parsed.data.description,
    },
  })

  return ok(milestone)
})

