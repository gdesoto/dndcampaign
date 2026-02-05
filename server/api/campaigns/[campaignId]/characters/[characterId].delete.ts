import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  const characterId = event.context.params?.characterId
  if (!campaignId || !characterId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign and character id are required')
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerId: session.user.id },
  })
  if (!campaign) {
    return fail(404, 'NOT_FOUND', 'Campaign not found')
  }

  const link = await prisma.campaignCharacter.findUnique({
    where: { campaignId_characterId: { campaignId, characterId } },
  })
  if (!link) {
    return fail(404, 'NOT_FOUND', 'Character not linked to campaign')
  }

  await prisma.campaignCharacter.delete({ where: { id: link.id } })
  return ok({ success: true })
})
