import { fail, respond } from '#server/utils/http'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const publicSlug = event.context.params?.publicSlug
  if (!publicSlug) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Public slug is required')
  }

  const result = await publicAccessService.getPublicGlossary(publicSlug)
  return respond(event, result)
})
