import { fail, respond } from '#server/utils/http'
import { CampaignMembershipService } from '#server/services/campaign-membership.service'

const membershipService = new CampaignMembershipService()

export default defineEventHandler(async (event) => {
  const inviteToken = event.context.params?.token
  if (!inviteToken) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invite token is required')
  }

  const session = await requireUserSession(event)
  const result = await membershipService.inspectInvite(inviteToken, session.user.id, session.user.email)

  return respond(event, result)
})
