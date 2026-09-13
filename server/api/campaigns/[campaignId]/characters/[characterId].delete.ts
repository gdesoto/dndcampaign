import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calculateCharacterUnlinkAccessImpact } from '#server/utils/character-auth'

export default defineEventHandler(async (event) => {
  const { campaignId, characterId } = routeParams(event, 'campaignId', 'characterId')
  await requireCampaignPermission(event, campaignId, 'content.write')

  const link = await prisma.campaignCharacter.findUnique({
    where: { campaignId_characterId: { campaignId, characterId } },
  })
  if (!link) {
    throw apiError(404, 'NOT_FOUND', 'Character not linked to campaign')
  }

  const accessImpact = await calculateCharacterUnlinkAccessImpact(campaignId, characterId)
  await prisma.campaignCharacter.delete({ where: { id: link.id } })

  if (link.glossaryEntryId) {
    await prisma.glossaryEntry.delete({
      where: { id: link.glossaryEntryId },
    })
  }
  return ok({ success: true, accessImpact })
})
