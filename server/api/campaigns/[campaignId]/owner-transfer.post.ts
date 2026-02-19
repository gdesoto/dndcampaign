import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { CampaignMembershipService } from '#server/services/campaign-membership.service'
import { campaignOwnerTransferSchema } from '#shared/schemas/campaign-membership'

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

  const parsed = await readValidatedBodySafe(event, campaignOwnerTransferSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid owner transfer payload', parsed.fieldErrors)
  }

  const result = await membershipService.transferOwnership(campaignId, authz.session.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
