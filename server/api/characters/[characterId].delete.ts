import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
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

  const character = await db.query.playerCharacter.findFirst({
    where: and(
      eq(tables.playerCharacter.id, characterId),
      eq(tables.playerCharacter.ownerId, session.user.id),
    ),
  })
  if (!character) {
    throw apiError(404, 'NOT_FOUND', 'Character not found')
  }

  const links = await db.query.campaignCharacter.findMany({
    where: eq(tables.campaignCharacter.characterId, character.id),
    columns: { glossaryEntryId: true },
  })

  await db.delete(tables.playerCharacter).where(eq(tables.playerCharacter.id, character.id)).run()

  const glossaryIds = links.map((link) => link.glossaryEntryId).filter(Boolean) as string[]
  if (glossaryIds.length) {
    await db.delete(tables.glossaryEntry).where(inArray(tables.glossaryEntry.id, glossaryIds)).run()
  }
  return ok({ success: true })
})
