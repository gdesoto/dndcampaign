import { ok, fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
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

  const parsed = await validateBody(event, campaignMemberUpdateSchema, 'Invalid member update payload')
  if (!parsed.ok) return parsed.response

  const result = await membershipService.updateMember(campaignId, memberId, authz.session.user.id, parsed.data)
  if (!result.ok) {
    return respond(event, result)
  }

  return ok({ member: result.data })
})
