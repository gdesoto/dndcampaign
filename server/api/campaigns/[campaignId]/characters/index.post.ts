import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readBody } from 'h3'
import { CharacterSyncService } from '#server/services/character-sync.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }
  const authz = await requireCampaignPermission(event, campaignId, 'content.write')
  if (!authz.ok) return authz.response

  const body = (await readBody(event)) as { characterId?: string }
  if (!body?.characterId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Character id is required')
  }

  const character = await prisma.playerCharacter.findFirst({
    where: { id: body.characterId, ownerId: authz.session.user.id },
  })
  if (!character) {
    return fail(event, 404, 'NOT_FOUND', 'Character not found')
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
