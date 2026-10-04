import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { campaignCharacterUpdateSchema } from '#shared/schemas/character'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId, characterId } = routeParams(event, 'campaignId', 'characterId')
  await requireCampaignPermission(event, campaignId, 'content.write')

  const parsed = await validateBody(event, campaignCharacterUpdateSchema, 'Invalid payload')

  const link = await db.query.campaignCharacter.findFirst({
    where: and(
      eq(tables.campaignCharacter.campaignId, campaignId),
      eq(tables.campaignCharacter.characterId, characterId),
    ),
  })
  if (!link) {
    throw apiError(404, 'NOT_FOUND', 'Character not linked to campaign')
  }

  const updated = await db.update(tables.campaignCharacter).set({
    status: parsed.status ?? link.status,
    roleLabel: parsed.roleLabel ?? link.roleLabel,
    notes: parsed.notes ?? link.notes,
  }).where(eq(tables.campaignCharacter.id, link.id)).returning().get()!
  return ok(updated)
})
