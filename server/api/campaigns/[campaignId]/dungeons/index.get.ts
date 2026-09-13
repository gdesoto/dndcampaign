import { validateQuery } from '#server/utils/validate'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { dungeonListQuerySchema } from '#shared/schemas/dungeon'
import { DungeonService } from '#server/services/dungeon/dungeon.service'

const dungeonService = new DungeonService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.read')
  const query = validateQuery(event, dungeonListQuerySchema, 'Invalid dungeon query parameters')

  const result = await dungeonService.listDungeons(campaignId, actor, query)
  return ok(result)
})
