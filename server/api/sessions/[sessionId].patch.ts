import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { sessionUpdateSchema } from '#shared/schemas/session'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const parsed = await readValidatedBodySafe(event, sessionUpdateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid session payload', parsed.fieldErrors)
  }

  const existing = await prisma.session.findFirst({
    where: { id: sessionId, campaign: { ownerId: sessionUser.user.id } },
  })
  if (!existing) {
    return fail(404, 'NOT_FOUND', 'Session not found')
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

