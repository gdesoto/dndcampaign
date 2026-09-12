import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { milestoneCreateSchema } from '#shared/schemas/milestone'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'content.write')
  if (!authz.ok) {
    return authz.response
  }

  const parsed = await validateBody(event, milestoneCreateSchema, 'Invalid milestone payload')
  if (!parsed.ok) return parsed.response

  const milestone = await prisma.milestone.create({
    data: {
      campaignId,
      title: parsed.data.title,
      description: parsed.data.description,
    },
  })

  return ok(milestone)
})

