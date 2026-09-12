import { fail, respond } from '#server/utils/http'
import { CampaignRequestsService } from '#server/services/campaign-requests.service'

const campaignRequestsService = new CampaignRequestsService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const requestId = event.context.params?.requestId
  if (!campaignId || !requestId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and request id are required')
  }

  const sessionUser = await requireUserSession(event)
  const result = await campaignRequestsService.addVote(
    campaignId,
    requestId,
    sessionUser.user.id,
    sessionUser.user.systemRole,
  )
  return respond(event, result)
})
