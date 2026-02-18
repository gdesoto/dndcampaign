import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { resolveCharacterAccess } from '#server/utils/character-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const characterId = event.context.params?.characterId
  if (!characterId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Character id is required')
  }
  const access = await resolveCharacterAccess(characterId, session.user.id, session.user.systemRole)
  if (!access.exists) {
    return fail(event, 404, 'NOT_FOUND', 'Character not found')
  }
  if (!access.canEdit) {
    return fail(event, 403, 'FORBIDDEN', 'You do not have permission to delete this character')
  }

  const character = await prisma.playerCharacter.findFirst({
    where: { id: characterId, ownerId: session.user.id },
  })
  if (!character) {
    return fail(event, 404, 'NOT_FOUND', 'Character not found')
  }

  const links = await prisma.campaignCharacter.findMany({
    where: { characterId: character.id },
    select: { glossaryEntryId: true },
  })

  await prisma.playerCharacter.delete({ where: { id: character.id } })

  const glossaryIds = links.map((link) => link.glossaryEntryId).filter(Boolean) as string[]
  if (glossaryIds.length) {
    await prisma.glossaryEntry.deleteMany({
      where: { id: { in: glossaryIds } },
    })
  }
  return ok({ success: true })
})
