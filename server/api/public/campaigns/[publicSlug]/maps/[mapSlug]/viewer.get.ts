import { ok, routeParams } from '#server/utils/http'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const { publicSlug, mapSlug } = routeParams(event, 'publicSlug', 'mapSlug')

  const result = await publicAccessService.getPublicMapViewer(publicSlug, mapSlug)
  return ok(result)
})
