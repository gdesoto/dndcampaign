import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq, desc } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { calculateCharacterUnlinkAccessImpact, resolveCharacterAccess } from '#server/utils/character-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { characterId } = routeParams(event, 'characterId')
  const access = await resolveCharacterAccess(characterId, session.user.id, session.user.systemRole)
  if (!access.exists || !access.canRead) {
    throw apiError(404, 'NOT_FOUND', 'Character not found')
  }

  const character = await db.query.playerCharacter.findFirst({
    where: eq(tables.playerCharacter.id, characterId),
    with: {
      campaignLinks: {
        with: {
          campaign: {
            columns: { id: true, name: true },
          },
        },
      },
      imports: {
        orderBy: [desc(tables.characterImport.importedAt)],
        limit: 1,
      },
    },
  })

  if (!character) {
    throw apiError(404, 'NOT_FOUND', 'Character not found')
  }

  const campaignLinks = await Promise.all(
    character.campaignLinks.map(async (link) => ({
      ...link,
      accessImpact: await calculateCharacterUnlinkAccessImpact(link.campaignId, character.id),
    }))
  )

  return ok({
    ...character,
    campaignLinks,
    canEdit: access.canEdit,
    isOwner: character.ownerId === session.user.id,
  })
})
