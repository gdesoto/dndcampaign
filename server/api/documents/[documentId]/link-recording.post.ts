import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { documentLinkRecordingSchema } from '#shared/schemas/document'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const documentId = event.context.params?.documentId
  if (!documentId) {
    return fail(400, 'VALIDATION_ERROR', 'Document id is required')
  }

  const parsed = await readValidatedBodySafe(event, documentLinkRecordingSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid request', parsed.fieldErrors)
  }

  const document = await prisma.document.findFirst({
    where: { id: documentId, campaign: { ownerId: sessionUser.user.id } },
  })
  if (!document) {
    return fail(404, 'NOT_FOUND', 'Document not found')
  }

  const recordingId = parsed.data.recordingId
  if (recordingId) {
    const recording = await prisma.recording.findFirst({
      where: { id: recordingId, session: { campaign: { ownerId: sessionUser.user.id } } },
    })
    if (!recording) {
      return fail(404, 'NOT_FOUND', 'Recording not found')
    }
  }

  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { recordingId: recordingId || null },
    include: { currentVersion: true },
  })

  return ok(updated)
})
