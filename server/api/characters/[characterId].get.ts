import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { calculateCharacterUnlinkAccessImpact, resolveCharacterAccess } from '#server/utils/character-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { characterId } = routeParams(event, 'characterId')
  const access = await resolveCharacterAccess(characterId, session.user.id, session.user.systemRole)
  if (!access.exists || !access.canRead) {
    throw apiError(404, 'NOT_FOUND', 'Character not found')
  }

  const character = await prisma.playerCharacter.findUnique({
    where: { id: characterId },
    include: {
      campaignLinks: {
        include: {
          campaign: {
            select: { id: true, name: true },
          },
        },
      },
      imports: { orderBy: { importedAt: 'desc' }, take: 1 },
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
