import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { entryId, sessionId } = routeParams(event, 'entryId', 'sessionId')

  const entry = await db.query.glossaryEntry.findFirst({
    where: and(
      eq(tables.glossaryEntry.id, entryId),
      buildCampaignWhereForPermission(sessionUser.user.id, 'content.write', tables.glossaryEntry.campaignId),
    ),
  })
  if (!entry) {
    throw apiError(404, 'NOT_FOUND', 'Glossary entry not found')
  }

  const existing = await db.query.glossarySessionLink.findFirst({
    where: and(
      eq(tables.glossarySessionLink.glossaryEntryId, entryId),
      eq(tables.glossarySessionLink.sessionId, sessionId),
    ),
  })
  if (!existing) {
    return ok({ success: true })
  }

  await db.delete(tables.glossarySessionLink).where(and(eq(tables.glossarySessionLink.glossaryEntryId, entryId), eq(tables.glossarySessionLink.sessionId, sessionId))).run()

  return ok({ success: true })
})

