import { fail, respond } from '#server/utils/http'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const publicSlug = event.context.params?.publicSlug
  const mapSlug = event.context.params?.mapSlug
  if (!publicSlug || !mapSlug) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Public slug and map slug are required')
  }

  const result = await publicAccessService.getPublicMapViewer(publicSlug, mapSlug)
  return respond(event, result)
})
