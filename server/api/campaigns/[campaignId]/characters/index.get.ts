import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq, desc } from 'drizzle-orm'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calculateCharacterUnlinkAccessImpact } from '#server/utils/character-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')
  const authz = await requireCampaignPermission(event, campaignId, 'content.read')

  const links = await db.query.campaignCharacter.findMany({
    where: eq(tables.campaignCharacter.campaignId, campaignId),
    with: {
      character: true,
    },
    orderBy: [desc(tables.campaignCharacter.updatedAt)],
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
