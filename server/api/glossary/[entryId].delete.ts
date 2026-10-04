import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireApiUserSession(event)
  const { entryId } = routeParams(event, 'entryId')

  const existing = await db.query.glossaryEntry.findFirst({
    where: and(
      eq(tables.glossaryEntry.id, entryId),
      buildCampaignWhereForPermission(session.user.id, 'content.write', tables.glossaryEntry.campaignId),
    ),
  })
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Glossary entry not found')
  }

  if (existing.type === 'PC') {
    await db.delete(tables.campaignCharacter).where(eq(tables.campaignCharacter.glossaryEntryId, existing.id)).run()
  }

  await db.delete(tables.glossaryEntry).where(eq(tables.glossaryEntry.id, entryId)).run()
  return ok({ success: true })
})

