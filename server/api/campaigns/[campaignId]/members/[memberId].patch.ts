import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { CampaignMembershipService } from '#server/services/campaign-membership.service'
import { campaignMemberUpdateSchema } from '#shared/schemas/campaign-membership'

const membershipService = new CampaignMembershipService()

export default defineEventHandler(async (event) => {
  const { campaignId, memberId } = routeParams(event, 'campaignId', 'memberId')

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.members.manage')

  const parsed = await validateBody(event, campaignMemberUpdateSchema, 'Invalid member update payload')

  const result = await membershipService.updateMember(campaignId, memberId, authz.session.user.id, parsed)

  return ok({ member: result })
})
