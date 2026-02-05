import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const characterId = event.context.params?.characterId
  if (!characterId) {
    return fail(400, 'VALIDATION_ERROR', 'Character id is required')
  }

  const character = await prisma.playerCharacter.findFirst({
    where: { id: characterId, ownerId: session.user.id },
  })
  if (!character) {
    return fail(404, 'NOT_FOUND', 'Character not found')
  }

  await prisma.playerCharacter.delete({ where: { id: character.id } })
  return ok({ success: true })
})
