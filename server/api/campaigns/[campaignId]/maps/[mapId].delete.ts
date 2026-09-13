import { MapService } from '#server/services/map.service'
import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId, mapId } = routeParams(event, 'campaignId', 'mapId')
  await requireCampaignPermission(event, campaignId, 'content.write')

  const deleted = await new MapService().deleteMap(campaignId, mapId)
  if (!deleted) {
    throw apiError(404, 'NOT_FOUND', 'Map not found')
  }

  return ok(deleted)
})
