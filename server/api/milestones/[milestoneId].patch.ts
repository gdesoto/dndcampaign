//import { requireUserSession } from '#auth-utils'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { milestoneUpdateSchema } from '#shared/schemas/milestone'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const milestoneId = event.context.params?.milestoneId
  if (!milestoneId) {
    return fail(400, 'VALIDATION_ERROR', 'Milestone id is required')
  }

  const parsed = await readValidatedBodySafe(event, milestoneUpdateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid milestone payload', parsed.fieldErrors)
  }

  const existing = await prisma.milestone.findFirst({
    where: { id: milestoneId, campaign: { ownerId: session.user.id } },
  })
  if (!existing) {
    return fail(404, 'NOT_FOUND', 'Milestone not found')
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
