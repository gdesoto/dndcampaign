import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { milestoneId } = routeParams(event, 'milestoneId')

  const existing = await db.query.milestone.findFirst({
    where: and(
      eq(tables.milestone.id, milestoneId),
      buildCampaignWhereForPermission(session.user.id, 'content.write', tables.milestone.campaignId),
    ),
  })
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Milestone not found')
  }

  await db.delete(tables.milestone).where(eq(tables.milestone.id, milestoneId)).run()

  return ok({ success: true })
})
