import { prisma } from '#server/db/prisma'
import { TranscriptService } from '#server/services/transcript.service'
import { transcriptQuerySchema } from '#shared/schemas/transcript'
import { validateQuery } from '#server/utils/validate'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { requireApiUserSession } from '#server/utils/api-auth'
import { apiError, ok, routeParams } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireApiUserSession(event)
  const { sessionId } = routeParams(event, 'sessionId')
  const query = validateQuery(event, transcriptQuerySchema, 'Invalid transcript query parameters')

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.read'),
    },
    select: { id: true },
  })
  if (!session) throw apiError(404, 'NOT_FOUND', 'Session not found')

  return ok(await new TranscriptService().readForSession(session.id, query))
})
