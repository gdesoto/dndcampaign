import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { CampaignMembershipService } from '#server/services/campaign-membership.service'

const membershipService = new CampaignMembershipService()

export default defineEventHandler(async (event) => {
  const { campaignId, memberId } = routeParams(event, 'campaignId', 'memberId')

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.members.manage')

  const result = await membershipService.removeMember(campaignId, memberId, authz.session.user.id)
  return ok(result)
})
