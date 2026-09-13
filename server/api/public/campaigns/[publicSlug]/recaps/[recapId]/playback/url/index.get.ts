import { ok, routeParams } from '#server/utils/http'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const { publicSlug, recapId } = routeParams(event, 'publicSlug', 'recapId')

  const result = await publicAccessService.getPublicRecapPlayback(publicSlug, recapId)
  return ok(result)
})
