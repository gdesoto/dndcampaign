import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { glossaryCreateSchema } from '#shared/schemas/glossary'
import { CharacterService } from '#server/services/character.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'content.write')
  if (!authz.ok) {
    return authz.response
  }

  const parsed = await readValidatedBodySafe(event, glossaryCreateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid glossary payload', parsed.fieldErrors)
  }

  const entry = await prisma.glossaryEntry.create({
    data: {
      campaignId,
      type: parsed.data.type,
      name: parsed.data.name,
      aliases: parsed.data.aliases,
      description: parsed.data.description,
    },
  })

  if (parsed.data.type === 'PC') {
    const characterService = new CharacterService()
    const existingCharacter = await prisma.playerCharacter.findFirst({
      where: { ownerId: session.user.id, name: parsed.data.name },
    })
    const character =
      existingCharacter ||
      (await characterService.createManualCharacter(session.user.id, parsed.data.name, {
        basics: { name: parsed.data.name },
        notes: { other: parsed.data.description },
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

