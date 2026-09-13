import { ok, apiError, routeParams } from '#server/utils/http'
import { MapService } from '#server/services/map.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')
  await requireCampaignPermission(event, campaignId, 'content.read')

  const maps = await new MapService().listMaps(campaignId)
  if (!maps) {
    throw apiError(404, 'NOT_FOUND', 'Campaign not found')
  }

  return ok(maps)
})
