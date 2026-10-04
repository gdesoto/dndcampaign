import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { desc } from 'drizzle-orm'
import { ok } from '#server/utils/http'
import { buildCharacterReadWhere } from '#server/utils/character-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const characters = await db.query.playerCharacter.findMany({
    where: session.user.systemRole === 'SYSTEM_ADMIN'
        ? undefined:buildCharacterReadWhere(session.user.id),
    orderBy: [desc(tables.playerCharacter.updatedAt)],
  })
  return ok(
    characters.map((character) => ({
      ...character,
      canEdit: character.ownerId === session.user.id,
      isOwner: character.ownerId === session.user.id,
    }))
  )
})
