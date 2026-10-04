import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { ok, apiError } from '#server/utils/http'
import { CharacterSyncService } from '#server/services/character-sync.service'
import { readBody } from 'h3'

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production') {
    throw apiError(403, 'FORBIDDEN', 'Migration endpoint is disabled in production.')
  }

  const session = await requireUserSession(event)
  const body = (await readBody(event)) as { campaignId?: string; deleteGlossary?: boolean }

  const campaigns = await db.query.campaign.findMany({
    where: and(
      eq(tables.campaign.ownerId, session.user.id),
      body.campaignId ? eq(tables.campaign.id, body.campaignId) : undefined,
    ),
    columns: { id: true },
  })

  if (!campaigns.length) {
    throw apiError(404, 'NOT_FOUND', 'No campaigns found')
  }

  const campaignIds = campaigns.map((campaign) => campaign.id)

  const glossaryEntries = await db.query.glossaryEntry.findMany({
    where: and(
      inArray(tables.glossaryEntry.campaignId, campaignIds),
      eq(tables.glossaryEntry.type, 'PC'),
    ),
  })

  const results: Array<{ glossaryId: string; characterId: string }> = []
  const syncService = new CharacterSyncService()

  for (const entry of glossaryEntries) {
    const { character } = await syncService.linkGlossaryPc({ ownerId: session.user.id, entry })
    results.push({ glossaryId: entry.id, characterId: character.id })
  }

  if (body.deleteGlossary) {
    await db.delete(tables.glossaryEntry).where(inArray(tables.glossaryEntry.id, glossaryEntries.map((entry) => entry.id))).run()
  }

  return ok({ migrated: results.length, results })
})
