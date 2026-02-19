import { ok, fail } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { CampaignMembershipService } from '#server/services/campaign-membership.service'

const membershipService = new CampaignMembershipService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.members.manage')
  if (!authz.ok) {
    return authz.response
  }

  const result = await membershipService.listMembers(campaignId)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
