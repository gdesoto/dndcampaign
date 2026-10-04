import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calculateCharacterUnlinkAccessImpact } from '#server/utils/character-auth'

export default defineEventHandler(async (event) => {
  const { campaignId, characterId } = routeParams(event, 'campaignId', 'characterId')
  await requireCampaignPermission(event, campaignId, 'content.write')

  const link = await db.query.campaignCharacter.findFirst({
    where: and(
      eq(tables.campaignCharacter.campaignId, campaignId),
      eq(tables.campaignCharacter.characterId, characterId),
    ),
  })
  if (!link) {
    throw apiError(404, 'NOT_FOUND', 'Character not linked to campaign')
  }

  const accessImpact = await calculateCharacterUnlinkAccessImpact(campaignId, characterId)
  await db.delete(tables.campaignCharacter).where(eq(tables.campaignCharacter.id, link.id)).run()

  if (link.glossaryEntryId) {
    await db.delete(tables.glossaryEntry).where(eq(tables.glossaryEntry.id, link.glossaryEntryId)).run()
  }
  return ok({ success: true, accessImpact })
})
