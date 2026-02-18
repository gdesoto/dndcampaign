import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calculateCharacterUnlinkAccessImpact } from '#server/utils/character-auth'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const characterId = event.context.params?.characterId
  if (!campaignId || !characterId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign and character id are required')
  }
  const authz = await requireCampaignPermission(event, campaignId, 'content.write')
  if (!authz.ok) return authz.response

  const link = await prisma.campaignCharacter.findUnique({
    where: { campaignId_characterId: { campaignId, characterId } },
  })
  if (!link) {
    return fail(event, 404, 'NOT_FOUND', 'Character not linked to campaign')
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
