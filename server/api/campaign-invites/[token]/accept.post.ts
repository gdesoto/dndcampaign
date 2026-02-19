import { ok, fail } from '#server/utils/http'
import { CampaignMembershipService } from '#server/services/campaign-membership.service'
import { enforceRateLimit } from '#server/utils/rate-limit'

const membershipService = new CampaignMembershipService()

export default defineEventHandler(async (event) => {
  const rateLimitResponse = enforceRateLimit(event, {
    key: 'campaign-invite:accept',
    max: 20,
    windowMs: 10 * 60_000,
  })
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  const inviteToken = event.context.params?.token
  if (!inviteToken) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invite token is required')
  }

  const session = await requireUserSession(event)

  const result = await membershipService.acceptInvite(inviteToken, session.user.id, session.user.email)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
