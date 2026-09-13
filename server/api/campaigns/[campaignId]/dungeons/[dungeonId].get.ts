import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { DungeonService } from '#server/services/dungeon/dungeon.service'

const dungeonService = new DungeonService()

export default defineEventHandler(async (event) => {
  const { campaignId, dungeonId } = routeParams(event, 'campaignId', 'dungeonId')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.read')
  const result = await dungeonService.getDungeon(campaignId, dungeonId, actor)
  return ok(result)
})
