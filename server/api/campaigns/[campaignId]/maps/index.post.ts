import { readMapMultipartUpload } from '#server/services/map-upload.service'
import { MapService } from '#server/services/map.service'
import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')
  const authz = await requireCampaignPermission(event, campaignId, 'content.write')

  const { fields, files } = await readMapMultipartUpload(event)
  const created = await new MapService().createMapFromUpload(campaignId, authz.session.user.id, fields, files)
  if (!created) {
    throw apiError(404, 'NOT_FOUND', 'Campaign not found')
  }
  return ok(created)
})
