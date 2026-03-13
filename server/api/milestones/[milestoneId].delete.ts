import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const milestoneId = event.context.params?.milestoneId
  if (!milestoneId) {
    return fail(400, 'VALIDATION_ERROR', 'Milestone id is required')
  }

  const existing = await prisma.milestone.findFirst({
    where: {
      id: milestoneId,
      campaign: buildCampaignWhereForPermission(session.user.id, 'content.write'),
    },
  })
  if (!existing) {
    return fail(404, 'NOT_FOUND', 'Milestone not found')
  }

  await prisma.milestone.delete({ where: { id: milestoneId } })

  return ok({ success: true })
})
