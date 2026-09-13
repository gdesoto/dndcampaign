import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { milestoneUpdateSchema } from '#shared/schemas/milestone'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { milestoneId } = routeParams(event, 'milestoneId')

  const parsed = await validateBody(event, milestoneUpdateSchema, 'Invalid milestone payload')

  const existing = await prisma.milestone.findFirst({
    where: {
      id: milestoneId,
      campaign: buildCampaignWhereForPermission(session.user.id, 'content.write'),
    },
  })
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Milestone not found')
  }

  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      ...parsed,
      completedAt: parsed.completedAt ? new Date(parsed.completedAt) : parsed.completedAt,
    },
  })

  return ok(updated)
})

