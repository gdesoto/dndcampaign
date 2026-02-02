import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const documentId = event.context.params?.documentId
  if (!documentId) {
    return fail(400, 'VALIDATION_ERROR', 'Document id is required')
  }

  const document = await prisma.document.findFirst({
    where: { id: documentId, campaign: { ownerId: sessionUser.user.id } },
    include: { currentVersion: true },
  })

  if (!document) {
    return fail(404, 'NOT_FOUND', 'Document not found')
  }

  return ok(document)
})
