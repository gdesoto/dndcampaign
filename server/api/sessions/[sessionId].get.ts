import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireApiUserSession(event)
  const { sessionId } = routeParams(event, 'sessionId')

  const session =
    (await db.query.session.findFirst({
      where: and(
        eq(tables.session.id, sessionId),
        buildCampaignWhereForPermission(
          sessionUser.user.id,
          'content.read',
          tables.session.campaignId
        )
      ),
      with: { campaign: { columns: { dungeonMasterName: true } } }
    })) ?? null

  if (!session) {
    throw apiError(404, 'NOT_FOUND', 'Session not found')
  }

  return ok(session)
})
