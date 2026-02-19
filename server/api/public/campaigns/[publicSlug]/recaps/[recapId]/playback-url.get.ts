import { fail, ok } from '#server/utils/http'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const publicSlug = event.context.params?.publicSlug
  const recapId = event.context.params?.recapId
  if (!publicSlug || !recapId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Public slug and recap id are required')
  }

  const result = await publicAccessService.getPublicRecapPlayback(publicSlug, recapId)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message)
  }

  return ok(result.data)
})
