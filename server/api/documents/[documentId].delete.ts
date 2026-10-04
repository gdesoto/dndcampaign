import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { ok, apiError, routeParams } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireApiUserSession(event)
  const { documentId } = routeParams(event, 'documentId')

  const document =
    (await db.query.document.findFirst({
      where: and(
        eq(tables.document.id, documentId),
        buildCampaignWhereForPermission(
          sessionUser.user.id,
          'document.edit',
          tables.document.campaignId
        )
      ),
      columns: { id: true, type: true }
    })) ?? null

  if (!document) {
    throw apiError(404, 'NOT_FOUND', 'Document not found')
  }

  if (document.type !== 'TRANSCRIPT') {
    throw apiError(
      400,
      'VALIDATION_ERROR',
      'Only transcript documents can be deleted here'
    )
  }

  await db.delete(tables.document).where(eq(tables.document.id, document.id))

  return ok({ success: true })
})
