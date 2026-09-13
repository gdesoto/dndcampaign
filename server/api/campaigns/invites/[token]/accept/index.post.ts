import { ok, routeParams } from '#server/utils/http'
import { CampaignMembershipService } from '#server/services/campaign-membership.service'
import { enforceRateLimit } from '#server/utils/rate-limit'

const membershipService = new CampaignMembershipService()

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, {
    key: 'campaign-invite:accept',
    max: 20,
    windowMs: 10 * 60_000,
  })

  const { token: inviteToken } = routeParams(event, 'token')

  const session = await requireUserSession(event)

  const result = await membershipService.acceptInvite(inviteToken, session.user.id, session.user.email)
  return ok(result)
})
