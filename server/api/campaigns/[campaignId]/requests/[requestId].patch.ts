import { fail, ok } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { campaignRequestUpdateSchema } from '#shared/schemas/campaign-requests'
import { CampaignRequestsService } from '#server/services/campaign-requests.service'

const campaignRequestsService = new CampaignRequestsService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const requestId = event.context.params?.requestId
  if (!campaignId || !requestId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and request id are required')
  }

  const parsed = await readValidatedBodySafe(event, campaignRequestUpdateSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid request update payload', parsed.fieldErrors)
  }

  const sessionUser = await requireUserSession(event)
  const result = await campaignRequestsService.updateRequest(
    campaignId,
    requestId,
    sessionUser.user.id,
    parsed.data,
    sessionUser.user.systemRole,
  )
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
