import { ok, fail } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { CampaignMembershipService } from '#server/services/campaign-membership.service'

const membershipService = new CampaignMembershipService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const memberId = event.context.params?.memberId
  if (!campaignId || !memberId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and member id are required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.members.manage')
  if (!authz.ok) {
    return authz.response
  }

  const result = await membershipService.removeMember(campaignId, memberId, authz.session.user.id)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
