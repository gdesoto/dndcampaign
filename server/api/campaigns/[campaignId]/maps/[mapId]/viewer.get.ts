import { MapService } from '#server/services/map.service'
import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId, mapId } = routeParams(event, 'campaignId', 'mapId')
  await requireCampaignPermission(event, campaignId, 'content.read')

  const viewer = await new MapService().getViewer(campaignId, mapId)
  if (!viewer) {
    throw apiError(404, 'NOT_FOUND', 'Map not found')
  }
  return ok(viewer)
})
