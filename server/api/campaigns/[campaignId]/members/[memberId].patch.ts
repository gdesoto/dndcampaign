import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { CampaignMembershipService } from '#server/services/campaign-membership.service'
import { campaignMemberUpdateSchema } from '#shared/schemas/campaign-membership'

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

  const parsed = await readValidatedBodySafe(event, campaignMemberUpdateSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid member update payload', parsed.fieldErrors)
  }

  const result = await membershipService.updateMember(campaignId, memberId, authz.session.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok({ member: result.data })
})
