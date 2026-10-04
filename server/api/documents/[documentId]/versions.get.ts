import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { DocumentService } from '#server/services/document.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { documentId } = routeParams(event, 'documentId')

  const existing =
    (await db.query.document.findFirst({
      where: and(
        eq(tables.document.id, documentId),
        buildCampaignWhereForPermission(
          sessionUser.user.id,
          'content.read',
          tables.document.campaignId
        )
      )
    })) ?? null
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
