import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { milestoneId } = routeParams(event, 'milestoneId')

  const existing = await prisma.milestone.findFirst({
    where: {
      id: milestoneId,
      campaign: buildCampaignWhereForPermission(session.user.id, 'content.write'),
    },
  })
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Milestone not found')
  }

  await prisma.milestone.delete({ where: { id: milestoneId } })

  return ok({ success: true })
})
