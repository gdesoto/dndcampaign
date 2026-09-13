import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { sessionUpdateSchema } from '#shared/schemas/session'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { sessionId } = routeParams(event, 'sessionId')

  const parsed = await validateBody(event, sessionUpdateSchema, 'Invalid session payload')

  const existing = await prisma.session.findFirst({
    where: {
      id: sessionId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.write'),
    },
  })
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Session not found')
  }

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: {
      ...parsed,
      playedAt: parsed.playedAt ? new Date(parsed.playedAt) : parsed.playedAt,
    },
  })

  return ok(updated)
})

