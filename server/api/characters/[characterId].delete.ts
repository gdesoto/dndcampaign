import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { resolveCharacterAccess } from '#server/utils/character-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { characterId } = routeParams(event, 'characterId')
  const access = await resolveCharacterAccess(characterId, session.user.id, session.user.systemRole)
  if (!access.exists) {
    throw apiError(404, 'NOT_FOUND', 'Character not found')
  }
  if (!access.canEdit) {
    throw apiError(403, 'FORBIDDEN', 'You do not have permission to delete this character')
  }

  const character = await prisma.playerCharacter.findFirst({
    where: { id: characterId, ownerId: session.user.id },
  })
  if (!character) {
    throw apiError(404, 'NOT_FOUND', 'Character not found')
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
