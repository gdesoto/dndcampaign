import { ok, routeParams } from '#server/utils/http'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const { publicSlug } = routeParams(event, 'publicSlug')

  const result = await publicAccessService.getPublicRecaps(publicSlug)
  return ok(result)
})
