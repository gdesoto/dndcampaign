import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.public.manage')

  const result = await publicAccessService.regenerateSlug(campaignId, authz.session.user.id)
  return ok(result)
})

