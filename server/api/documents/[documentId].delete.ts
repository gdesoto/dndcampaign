import { prisma } from '#server/db/prisma'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const documentId = event.context.params?.documentId
  if (!documentId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Document id is required')
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'document.edit'),
    },
    select: {
      id: true,
      type: true,
    },
  })

  if (!document) {
    return fail(event, 404, 'NOT_FOUND', 'Document not found')
  }

  if (document.type !== 'TRANSCRIPT') {
    return fail(event, 400, 'VALIDATION_ERROR', 'Only transcript documents can be deleted here')
  }

  await prisma.document.delete({
    where: { id: document.id },
  })

  return ok({ success: true })
})
