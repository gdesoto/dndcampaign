import { validateQuery } from '#server/utils/validate'
import { ok, routeParams } from '#server/utils/http'
import { campaignRequestListQuerySchema } from '#shared/schemas/campaign-requests'
import { CampaignRequestsService } from '#server/services/campaign-requests.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const campaignRequestsService = new CampaignRequestsService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const { session, access } = await requireCampaignPermission(event, campaignId, 'campaign.read')
  const parsedQuery = validateQuery(event, campaignRequestListQuerySchema, 'Invalid request query parameters')

  const result = await campaignRequestsService.listRequests(access,
    session.user.id,
    parsedQuery
  )
  return ok(result)
})
