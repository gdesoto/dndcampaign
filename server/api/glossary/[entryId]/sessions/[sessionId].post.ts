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

  const session = await db.query.session.findFirst({
    where: and(
      eq(tables.session.id, sessionId),
      buildCampaignWhereForPermission(sessionUser.user.id, 'content.write', tables.session.campaignId),
    ),
  })
  if (!session || session.campaignId !== entry.campaignId) {
    throw apiError(400, 'VALIDATION_ERROR', 'Session does not belong to campaign')
  }

  const link = db.transaction((tx) => {
    tx.insert(tables.glossarySessionLink).values({ glossaryEntryId: entryId, sessionId })
      .onConflictDoNothing({ target: [tables.glossarySessionLink.glossaryEntryId, tables.glossarySessionLink.sessionId] }).run()
    return tx.query.glossarySessionLink.findFirst({
      where: and(
        eq(tables.glossarySessionLink.glossaryEntryId, entryId),
        eq(tables.glossarySessionLink.sessionId, sessionId),
      ),
    }).sync()!
  }, { behavior: 'immediate' })

  return ok(link)
})

