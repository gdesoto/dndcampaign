import { fail, respond } from '#server/utils/http'
import { CampaignJournalService } from '#server/services/campaign-journal.service'

const campaignJournalService = new CampaignJournalService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const sessionUser = await requireUserSession(event)
  const result = await campaignJournalService.listMemberOptions(
    campaignId,
    sessionUser.user.id,
    sessionUser.user.systemRole
  )
  return respond(event, result)
})

