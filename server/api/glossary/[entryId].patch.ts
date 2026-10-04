import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { glossaryUpdateSchema } from '#shared/schemas/glossary'
import { CharacterSyncService } from '#server/services/character-sync.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireApiUserSession(event)
  const { entryId } = routeParams(event, 'entryId')

  const parsed = await validateBody(event, glossaryUpdateSchema, 'Invalid glossary payload')

  const existing = await db.query.glossaryEntry.findFirst({
    where: and(
      eq(tables.glossaryEntry.id, entryId),
      buildCampaignWhereForPermission(session.user.id, 'content.write', tables.glossaryEntry.campaignId),
    ),
  })
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Glossary entry not found')
  }

  const updated = Object.values(parsed).some((value) => value !== undefined)
    ? db.update(tables.glossaryEntry).set(parsed).where(eq(tables.glossaryEntry.id, entryId)).returning().get()!
    : existing

  if (updated.type === 'PC') {
    const syncService = new CharacterSyncService()
    await syncService.syncCharacterFromGlossary(updated.id, session.user.id)
  }

  return ok(updated)
})

