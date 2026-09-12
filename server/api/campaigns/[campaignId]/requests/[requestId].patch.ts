import { fail, respond } from '#server/utils/http'
import { validateInput } from '#server/utils/validate'
import {
  campaignRequestDecisionInputSchema,
  campaignRequestUpdateSchema,
} from '#shared/schemas/campaign-requests'
import { CampaignRequestsService } from '#server/services/campaign-requests.service'

const campaignRequestsService = new CampaignRequestsService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const requestId = event.context.params?.requestId
  if (!campaignId || !requestId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and request id are required')
  }

  const rawBody = ((await readBody(event).catch(() => null)) ?? {}) as Record<string, unknown>
  const action = typeof rawBody.action === 'string' ? rawBody.action : null
  const sessionUser = await requireUserSession(event)

  if (action === 'cancel') {
    const result = await campaignRequestsService.cancelRequest(
      campaignId,
      requestId,
      sessionUser.user.id,
      sessionUser.user.systemRole,
    )
    return respond(event, result)
  }

  if (action === 'decision') {
    const decisionParsed = validateInput(event, campaignRequestDecisionInputSchema, rawBody, 'Invalid request decision payload')
    if (!decisionParsed.ok) return decisionParsed.response

    const result = await campaignRequestsService.decideRequest(
      campaignId,
      requestId,
      sessionUser.user.id,
      decisionParsed.data,
      sessionUser.user.systemRole,
    )
    return respond(event, result)
  }

  const parsed = validateInput(event, campaignRequestUpdateSchema, rawBody, 'Invalid request update payload')
  if (!parsed.ok) return parsed.response

  const result = await campaignRequestsService.updateRequest(
    campaignId,
    requestId,
    sessionUser.user.id,
    parsed.data,
    sessionUser.user.systemRole,
  )
  return respond(event, result)
})
