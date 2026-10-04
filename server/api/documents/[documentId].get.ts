import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireApiUserSession(event)
  const { documentId } = routeParams(event, 'documentId')

  const document =
    (await db.query.document.findFirst({
      where: and(
        eq(tables.document.id, documentId),
        buildCampaignWhereForPermission(
          sessionUser.user.id,
          'content.read',
          tables.document.campaignId
        )
      ),
      with: { currentVersion: true }
    })) ?? null

  if (!document) {
    throw apiError(404, 'NOT_FOUND', 'Document not found')
  }

  return ok(document)
})
