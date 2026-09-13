import { ok, routeParams } from '#server/utils/http'
import { validateInput } from '#server/utils/validate'
import {
  campaignRequestDecisionInputSchema,
  campaignRequestUpdateSchema,
} from '#shared/schemas/campaign-requests'
import { CampaignRequestsService } from '#server/services/campaign-requests.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const campaignRequestsService = new CampaignRequestsService()

export default defineEventHandler(async (event) => {
  const { campaignId, requestId } = routeParams(event, 'campaignId', 'requestId')

  const rawBody = ((await readBody(event).catch(() => null)) ?? {}) as Record<string, unknown>
  const action = typeof rawBody.action === 'string' ? rawBody.action : null
  const { session, access } = await requireCampaignPermission(event, campaignId, 'campaign.read')

  if (action === 'cancel') {
    const result = await campaignRequestsService.cancelRequest(access,
      requestId,
      session.user.id
    )
    return ok(result)
  }

  if (action === 'decision') {
    const decisionParsed = validateInput(campaignRequestDecisionInputSchema, rawBody, 'Invalid request decision payload')

    const result = await campaignRequestsService.decideRequest(access,
      requestId,
      session.user.id,
      decisionParsed
    )
    return ok(result)
  }

  const parsed = validateInput(campaignRequestUpdateSchema, rawBody, 'Invalid request update payload')

  const result = await campaignRequestsService.updateRequest(access,
    requestId,
    session.user.id,
    parsed
  )
  return ok(result)
})
