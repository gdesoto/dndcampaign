import { prisma } from '#server/db/prisma'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calculateCharacterUnlinkAccessImpact } from '#server/utils/character-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')
  const authz = await requireCampaignPermission(event, campaignId, 'content.read')

  const links = await prisma.campaignCharacter.findMany({
    where: { campaignId },
    include: {
      character: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  const linksWithAccessImpact = await Promise.all(
    links.map(async (link) => {
      const accessImpact = await calculateCharacterUnlinkAccessImpact(campaignId, link.characterId)
      return {
        ...link,
        character: {
          ...link.character,
          canEdit: link.character.ownerId === authz.session.user.id,
          isOwner: link.character.ownerId === authz.session.user.id,
        },
        accessImpact,
      }
    })
  )

  return ok(linksWithAccessImpact)
})
