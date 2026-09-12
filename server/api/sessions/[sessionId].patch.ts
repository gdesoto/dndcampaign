import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { sessionUpdateSchema } from '#shared/schemas/session'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const parsed = await validateBody(event, sessionUpdateSchema, 'Invalid session payload')
  if (!parsed.ok) return parsed.response

  const existing = await prisma.session.findFirst({
    where: {
      id: sessionId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.write'),
    },
  })
  if (!existing) {
    return fail(event, 404, 'NOT_FOUND', 'Session not found')
  }

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: {
      ...parsed.data,
      playedAt: parsed.data.playedAt ? new Date(parsed.data.playedAt) : parsed.data.playedAt,
    },
  })

  return ok(updated)
})

