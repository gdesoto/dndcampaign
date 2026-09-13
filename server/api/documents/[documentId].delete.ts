import { prisma } from '#server/db/prisma'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { ok, apiError, routeParams } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { documentId } = routeParams(event, 'documentId')

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
    throw apiError(404, 'NOT_FOUND', 'Document not found')
  }

  if (document.type !== 'TRANSCRIPT') {
    throw apiError(400, 'VALIDATION_ERROR', 'Only transcript documents can be deleted here')
  }

  await prisma.document.delete({
    where: { id: document.id },
  })

  return ok({ success: true })
})
