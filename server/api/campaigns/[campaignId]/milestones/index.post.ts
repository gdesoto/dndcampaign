import { prisma } from '#server/db/prisma'
import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { milestoneCreateSchema } from '#shared/schemas/milestone'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.write')

  const parsed = await validateBody(event, milestoneCreateSchema, 'Invalid milestone payload')

  const milestone = await prisma.milestone.create({
    data: {
      campaignId,
      title: parsed.title,
      description: parsed.description,
    },
  })

  return ok(milestone)
})

