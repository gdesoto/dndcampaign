import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { campaignRequestCreateSchema } from '#shared/schemas/campaign-requests'
import { CampaignRequestsService } from '#server/services/campaign-requests.service'

const campaignRequestsService = new CampaignRequestsService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const parsed = await validateBody(event, campaignRequestCreateSchema, 'Invalid request payload')
  if (!parsed.ok) return parsed.response

  const sessionUser = await requireUserSession(event)
  const result = await campaignRequestsService.createRequest(
    campaignId,
    sessionUser.user.id,
    parsed.data,
    sessionUser.user.systemRole,
  )
  return respond(event, result)
})
