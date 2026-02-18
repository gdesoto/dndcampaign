import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { documentUpdateSchema } from '#shared/schemas/document'
import { DocumentService } from '#server/services/document.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const documentId = event.context.params?.documentId
  if (!documentId) {
    return fail(400, 'VALIDATION_ERROR', 'Document id is required')
  }

  const parsed = await readValidatedBodySafe(event, documentUpdateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid document payload', parsed.fieldErrors)
  }

  const existing = await prisma.document.findFirst({
    where: {
      id: documentId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'document.edit'),
    },
  })
  if (!existing) {
    return fail(404, 'NOT_FOUND', 'Document not found')
  }

  const service = new DocumentService()
  const updated = await service.updateDocument({
    documentId,
    content: parsed.data.content,
    format: parsed.data.format,
    source: 'USER_EDIT',
    createdByUserId: sessionUser.user.id,
  })

  return ok(updated)
})
