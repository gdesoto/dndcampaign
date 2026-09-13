import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { campaignCharacterUpdateSchema } from '#shared/schemas/character'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId, characterId } = routeParams(event, 'campaignId', 'characterId')
  await requireCampaignPermission(event, campaignId, 'content.write')

  const parsed = await validateBody(event, campaignCharacterUpdateSchema, 'Invalid payload')

  const link = await prisma.campaignCharacter.findUnique({
    where: { campaignId_characterId: { campaignId, characterId } },
  })
  if (!link) {
    throw apiError(404, 'NOT_FOUND', 'Character not linked to campaign')
  }

  const updated = await prisma.campaignCharacter.update({
    where: { id: link.id },
    data: {
      status: parsed.status ?? link.status,
      roleLabel: parsed.roleLabel ?? link.roleLabel,
      notes: parsed.notes ?? link.notes,
    },
  })
  return ok(updated)
})
