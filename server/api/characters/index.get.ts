import { prisma } from '#server/db/prisma'
import { ok } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const characters = await prisma.playerCharacter.findMany({
    where: { ownerId: session.user.id },
    orderBy: { updatedAt: 'desc' },
  })
  return ok(characters)
})
