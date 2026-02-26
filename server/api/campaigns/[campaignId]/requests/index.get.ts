import { getQuery } from 'h3'
import { fail, ok } from '#server/utils/http'
import { campaignRequestListQuerySchema } from '#shared/schemas/campaign-requests'
import { CampaignRequestsService } from '#server/services/campaign-requests.service'

const campaignRequestsService = new CampaignRequestsService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const sessionUser = await requireUserSession(event)
  const parsedQuery = campaignRequestListQuerySchema.safeParse(getQuery(event))
  if (!parsedQuery.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid request query parameters')
  }

  const result = await campaignRequestsService.listRequests(
    campaignId,
    sessionUser.user.id,
    parsedQuery.data,
    sessionUser.user.systemRole,
  )
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
