import { ok, routeParams } from '#server/utils/http'
import { CampaignMembershipService } from '#server/services/campaign-membership.service'

const membershipService = new CampaignMembershipService()

export default defineEventHandler(async (event) => {
  const { token: inviteToken } = routeParams(event, 'token')

  const session = await requireUserSession(event)
  const result = await membershipService.inspectInvite(inviteToken, session.user.id, session.user.email)

  return ok(result)
})
