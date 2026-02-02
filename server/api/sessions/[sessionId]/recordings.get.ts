import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const session = await prisma.session.findFirst({
    where: { id: sessionId, campaign: { ownerId: sessionUser.user.id } },
  })
  if (!session) {
    return fail(404, 'NOT_FOUND', 'Session not found')
  }

  const recordings = await prisma.recording.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
  })

  return ok(recordings)
})



