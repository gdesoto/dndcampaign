import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { campaignRequestCreateSchema } from '#shared/schemas/campaign-requests'
import { CampaignRequestsService } from '#server/services/campaign-requests.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const campaignRequestsService = new CampaignRequestsService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const parsed = await validateBody(event, campaignRequestCreateSchema, 'Invalid request payload')

  const { session, access } = await requireCampaignPermission(event, campaignId, 'campaign.read')
  const result = await campaignRequestsService.createRequest(access,
    session.user.id,
    parsed
  )
  return ok(result)
})
