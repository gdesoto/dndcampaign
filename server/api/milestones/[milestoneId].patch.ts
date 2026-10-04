import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { milestoneUpdateSchema } from '#shared/schemas/milestone'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { milestoneId } = routeParams(event, 'milestoneId')

  const parsed = await validateBody(event, milestoneUpdateSchema, 'Invalid milestone payload')

  const existing = await db.query.milestone.findFirst({
    where: and(
      eq(tables.milestone.id, milestoneId),
      buildCampaignWhereForPermission(session.user.id, 'content.write', tables.milestone.campaignId),
    ),
  })
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Milestone not found')
  }

  if (!Object.values(parsed).some((value) => value !== undefined)) {
    return ok(existing)
  }

  const updated = await db.update(tables.milestone).set({
    ...parsed,
    completedAt: typeof parsed.completedAt === 'string' ? new Date(parsed.completedAt) : parsed.completedAt,
  }).where(eq(tables.milestone.id, milestoneId)).returning().get()!

  return ok(updated)
})

