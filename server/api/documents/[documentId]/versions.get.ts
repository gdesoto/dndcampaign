import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { DocumentService } from '#server/services/document.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { documentId } = routeParams(event, 'documentId')

  const existing = await prisma.document.findFirst({
    where: {
      id: documentId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.read'),
    },
  })
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Document not found')
  }

  const query = getQuery(event)
  const includeContentRaw = query.includeContent
  const includeContent =
    includeContentRaw === true ||
    includeContentRaw === 'true' ||
    includeContentRaw === '1'

  const service = new DocumentService()
  const versions = await service.listVersions(documentId, { includeContent })
  return ok(versions)
})
