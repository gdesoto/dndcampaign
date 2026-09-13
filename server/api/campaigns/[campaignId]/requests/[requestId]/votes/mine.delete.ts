import { ok, routeParams } from '#server/utils/http'
import { CampaignRequestsService } from '#server/services/campaign-requests.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const campaignRequestsService = new CampaignRequestsService()

export default defineEventHandler(async (event) => {
  const { campaignId, requestId } = routeParams(event, 'campaignId', 'requestId')

  const { session, access } = await requireCampaignPermission(event, campaignId, 'campaign.read')
  const result = await campaignRequestsService.removeMyVote(access,
    requestId,
    session.user.id
  )
  return ok(result)
})
