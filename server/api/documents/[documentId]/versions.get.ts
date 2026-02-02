import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { DocumentService } from '#server/services/document.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const documentId = event.context.params?.documentId
  if (!documentId) {
    return fail(400, 'VALIDATION_ERROR', 'Document id is required')
  }

  const existing = await prisma.document.findFirst({
    where: { id: documentId, campaign: { ownerId: sessionUser.user.id } },
  })
  if (!existing) {
    return fail(404, 'NOT_FOUND', 'Document not found')
  }

  const service = new DocumentService()
  const versions = await service.listVersions(documentId)
  return ok(versions)
})
