import { prisma } from '#server/db/prisma'
import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { glossaryCreateSchema } from '#shared/schemas/glossary'
import { CharacterService } from '#server/services/character.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.write')

  const parsed = await validateBody(event, glossaryCreateSchema, 'Invalid glossary payload')

  const entry = await prisma.glossaryEntry.create({
    data: {
      campaignId,
      type: parsed.type,
      name: parsed.name,
      aliases: parsed.aliases,
      description: parsed.description,
    },
  })

  if (parsed.type === 'PC') {
    const characterService = new CharacterService()
    const existingCharacter = await prisma.playerCharacter.findFirst({
      where: { ownerId: session.user.id, name: parsed.name },
    })
    const character =
      existingCharacter ||
      (await characterService.createManualCharacter(session.user.id, parsed.name, {
        basics: { name: parsed.name },
        notes: { other: parsed.description },
      }))

    await prisma.campaignCharacter.upsert({
      where: { campaignId_characterId: { campaignId, characterId: character.id } },
      update: { glossaryEntryId: entry.id },
      create: {
        campaignId,
        characterId: character.id,
        glossaryEntryId: entry.id,
      },
    })
  }

  return ok(entry)
})

