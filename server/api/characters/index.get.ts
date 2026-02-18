import { prisma } from '#server/db/prisma'
import { ok } from '#server/utils/http'
import { buildCharacterReadWhere } from '#server/utils/character-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const characters = await prisma.playerCharacter.findMany({
    where:
      session.user.systemRole === 'SYSTEM_ADMIN'
        ? undefined
        : buildCharacterReadWhere(session.user.id),
    orderBy: { updatedAt: 'desc' },
  })
  return ok(
    characters.map((character) => ({
      ...character,
      canEdit: character.ownerId === session.user.id,
      isOwner: character.ownerId === session.user.id,
    }))
  )
})
