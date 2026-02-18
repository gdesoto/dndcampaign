import { ok, fail } from '#server/utils/http'
import { MapService } from '#server/services/map.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }
  const authz = await requireCampaignPermission(event, campaignId, 'content.read')
  if (!authz.ok) return authz.response

  const maps = await new MapService().listMaps(campaignId, authz.session.user.id)
  if (!maps) {
    return fail(404, 'NOT_FOUND', 'Campaign not found')
  }

  return ok(maps)
})
