import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { documentId } = routeParams(event, 'documentId')

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.read'),
    },
    include: { currentVersion: true },
  })

  if (!document) {
    throw apiError(404, 'NOT_FOUND', 'Document not found')
  }

  return ok(document)
})
