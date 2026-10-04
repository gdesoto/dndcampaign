import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { readBody } from 'h3'
import { CharacterSyncService } from '#server/services/character-sync.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')
  const authz = await requireCampaignPermission(event, campaignId, 'content.write')

  const body = (await readBody(event)) as { characterId?: string }
  if (!body?.characterId) {
    throw apiError(400, 'VALIDATION_ERROR', 'Character id is required')
  }

  const character = await db.query.playerCharacter.findFirst({
    where: and(
      eq(tables.playerCharacter.id, body.characterId),
      eq(tables.playerCharacter.ownerId, authz.session.user.id),
    ),
  })
  if (!character) {
    throw apiError(404, 'NOT_FOUND', 'Character not found')
  }

  const syncService = new CharacterSyncService()
  const link = await db.insert(tables.campaignCharacter).values({ campaignId, characterId: body.characterId }).onConflictDoUpdate({ target: [tables.campaignCharacter.campaignId, tables.campaignCharacter.characterId], set: { status: 'ACTIVE' } }).returning().get()

  await syncService.ensureGlossaryEntryForCharacter({
    ownerId: authz.session.user.id,
    campaignId,
    characterId: body.characterId,
  })

  return ok(link)
})
