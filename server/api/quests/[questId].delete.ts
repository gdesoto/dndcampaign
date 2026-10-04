import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireApiUserSession(event)
  const { questId } = routeParams(event, 'questId')

  const existing = await db.query.quest.findFirst({
    where: and(
      eq(tables.quest.id, questId),
      buildCampaignWhereForPermission(session.user.id, 'content.write', tables.quest.campaignId),
    ),
  })
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Quest not found')
  }

  await db.delete(tables.quest).where(eq(tables.quest.id, questId)).run()
  return ok({ success: true })
})

