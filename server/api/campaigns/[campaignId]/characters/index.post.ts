import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerId: session.user.id },
  })
  if (!campaign) {
    return fail(404, 'NOT_FOUND', 'Campaign not found')
  }

  const body = (await readBody(event)) as { characterId?: string }
  if (!body?.characterId) {
    return fail(400, 'VALIDATION_ERROR', 'Character id is required')
  }

  const character = await prisma.playerCharacter.findFirst({
    where: { id: body.characterId, ownerId: session.user.id },
  })
  if (!character) {
    return fail(404, 'NOT_FOUND', 'Character not found')
  }

  const link = await prisma.campaignCharacter.upsert({
    where: { campaignId_characterId: { campaignId, characterId: body.characterId } },
    update: { status: 'ACTIVE' },
    create: { campaignId, characterId: body.characterId },
  })

  return ok(link)
})
