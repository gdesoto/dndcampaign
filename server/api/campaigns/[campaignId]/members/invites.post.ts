import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { CampaignMembershipService } from '#server/services/campaign-membership.service'
import { campaignInviteCreateSchema } from '#shared/schemas/campaign-membership'

const membershipService = new CampaignMembershipService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.members.manage')

  const parsed = await validateBody(event, campaignInviteCreateSchema, 'Invalid invite payload')

  const result = await membershipService.createInvite(campaignId, authz.session.user.id, parsed)
  return ok(result)
})
