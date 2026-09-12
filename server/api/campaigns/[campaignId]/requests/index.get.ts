import { validateQuery } from '#server/utils/validate'
import { fail, respond } from '#server/utils/http'
import { campaignRequestListQuerySchema } from '#shared/schemas/campaign-requests'
import { CampaignRequestsService } from '#server/services/campaign-requests.service'

const campaignRequestsService = new CampaignRequestsService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const sessionUser = await requireUserSession(event)
  const parsedQuery = validateQuery(event, campaignRequestListQuerySchema, 'Invalid request query parameters')
  if (!parsedQuery.ok) return parsedQuery.response

  const result = await campaignRequestsService.listRequests(
    campaignId,
    sessionUser.user.id,
    parsedQuery.data,
    sessionUser.user.systemRole,
  )
  return respond(event, result)
})
