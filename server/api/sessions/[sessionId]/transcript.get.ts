import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { TranscriptService } from '#server/services/transcript.service'
import { transcriptQuerySchema } from '#shared/schemas/transcript'
import { validateQuery } from '#server/utils/validate'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { requireApiUserSession } from '#server/utils/api-auth'
import { apiError, ok, routeParams } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireApiUserSession(event)
  const { sessionId } = routeParams(event, 'sessionId')
  const query = validateQuery(
    event,
    transcriptQuerySchema,
    'Invalid transcript query parameters'
  )

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
      columns: { id: true }
    })) ?? null
  if (!session) throw apiError(404, 'NOT_FOUND', 'Session not found')

  return ok(await new TranscriptService().readForSession(session.id, query))
})
