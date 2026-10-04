import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { parseTranscriptSegments } from '#shared/utils/transcript'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
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

  if (!document?.currentVersion) {
    throw apiError(404, 'NOT_FOUND', 'Document not found')
  }

  return ok({
    documentId: document.id,
    type: document.type,
    segments: parseTranscriptSegments(document.currentVersion.content || '')
  })
})
