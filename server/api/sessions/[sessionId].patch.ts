import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { sessionUpdateSchema } from '#shared/schemas/session'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireApiUserSession(event)
  const { sessionId } = routeParams(event, 'sessionId')

  const parsed = await validateBody(
    event,
    sessionUpdateSchema,
    'Invalid session payload'
  )

  const existing =
    (await db.query.session.findFirst({
      where: and(
        eq(tables.session.id, sessionId),
        buildCampaignWhereForPermission(
          sessionUser.user.id,
          'content.write',
          tables.session.campaignId
        )
      )
    })) ?? null
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Session not found')
  }

  const updated = (
    await db
      .update(tables.session)
      .set({
        ...parsed,
        playedAt: parsed.playedAt == null ? parsed.playedAt : new Date(parsed.playedAt)
      })
      .where(eq(tables.session.id, sessionId))
      .returning()
  )[0]!

  return ok(updated)
})
