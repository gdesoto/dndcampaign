import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { documentRestoreSchema } from '#shared/schemas/document'
import { DocumentService } from '#server/services/document.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const documentId = event.context.params?.documentId
  if (!documentId) {
    return fail(400, 'VALIDATION_ERROR', 'Document id is required')
  }

  const parsed = await readValidatedBodySafe(event, documentRestoreSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid restore payload', parsed.fieldErrors)
  }

  const existing = await prisma.document.findFirst({
    where: { id: documentId, campaign: { ownerId: sessionUser.user.id } },
  })
  if (!existing) {
    return fail(404, 'NOT_FOUND', 'Document not found')
  }

  const version = await prisma.documentVersion.findFirst({
    where: { id: parsed.data.versionId, documentId },
  })
  if (!version) {
    return fail(404, 'NOT_FOUND', 'Version not found')
  }

  const service = new DocumentService()
  const restored = await service.restoreVersion(documentId, version.id)
  return ok(restored)
})
