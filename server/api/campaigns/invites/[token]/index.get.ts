import { ok, fail } from '#server/utils/http'
import { CampaignMembershipService } from '#server/services/campaign-membership.service'

const membershipService = new CampaignMembershipService()

export default defineEventHandler(async (event) => {
  const inviteToken = event.context.params?.token
  if (!inviteToken) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invite token is required')
  }

  const session = await requireUserSession(event)
  const result = await membershipService.inspectInvite(inviteToken, session.user.id, session.user.email)

  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
