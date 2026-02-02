import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const recordingId = event.context.params?.recordingId
  if (!recordingId) {
    return fail(400, 'VALIDATION_ERROR', 'Recording id is required')
  }

  const recording = await prisma.recording.findFirst({
    where: { id: recordingId, session: { campaign: { ownerId: sessionUser.user.id } } },
  })
  if (!recording) {
    return fail(404, 'NOT_FOUND', 'Recording not found')
  }

  const url = `/api/artifacts/${recording.artifactId}/stream`
  return ok({ url, expiresAt: null })
})



