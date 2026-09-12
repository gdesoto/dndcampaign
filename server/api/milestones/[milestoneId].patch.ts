import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { milestoneUpdateSchema } from '#shared/schemas/milestone'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const milestoneId = event.context.params?.milestoneId
  if (!milestoneId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Milestone id is required')
  }

  const parsed = await validateBody(event, milestoneUpdateSchema, 'Invalid milestone payload')
  if (!parsed.ok) return parsed.response

  const existing = await prisma.milestone.findFirst({
    where: {
      id: milestoneId,
      campaign: buildCampaignWhereForPermission(session.user.id, 'content.write'),
    },
  })
  if (!existing) {
    return fail(event, 404, 'NOT_FOUND', 'Milestone not found')
  }

  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      ...parsed.data,
      completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : parsed.data.completedAt,
    },
  })

  return ok(updated)
})

