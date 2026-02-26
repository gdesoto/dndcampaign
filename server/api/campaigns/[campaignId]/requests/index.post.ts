import { fail, ok } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { campaignRequestCreateSchema } from '#shared/schemas/campaign-requests'
import { CampaignRequestsService } from '#server/services/campaign-requests.service'

const campaignRequestsService = new CampaignRequestsService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const parsed = await readValidatedBodySafe(event, campaignRequestCreateSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid request payload', parsed.fieldErrors)
  }

  const sessionUser = await requireUserSession(event)
  const result = await campaignRequestsService.createRequest(
    campaignId,
    sessionUser.user.id,
    parsed.data,
    sessionUser.user.systemRole,
  )
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
