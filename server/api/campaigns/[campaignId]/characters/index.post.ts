import { prisma } from '#server/db/prisma'
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

  const character = await prisma.playerCharacter.findFirst({
    where: { id: body.characterId, ownerId: authz.session.user.id },
  })
  if (!character) {
    throw apiError(404, 'NOT_FOUND', 'Character not found')
  }

  const syncService = new CharacterSyncService()
  const link = await prisma.campaignCharacter.upsert({
    where: { campaignId_characterId: { campaignId, characterId: body.characterId } },
    update: { status: 'ACTIVE' },
    create: { campaignId, characterId: body.characterId },
  })

  await syncService.ensureGlossaryEntryForCharacter({
    ownerId: authz.session.user.id,
    campaignId,
    characterId: body.characterId,
  })

  return ok(link)
})
