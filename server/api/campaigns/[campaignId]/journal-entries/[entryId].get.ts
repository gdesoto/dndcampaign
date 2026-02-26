import { fail, ok } from '#server/utils/http'
import { CampaignJournalService } from '#server/services/campaign-journal.service'

const campaignJournalService = new CampaignJournalService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const entryId = event.context.params?.entryId
  if (!campaignId || !entryId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and entry id are required')
  }

  const sessionUser = await requireUserSession(event)
  const result = await campaignJournalService.getEntryById(
    campaignId,
    entryId,
    sessionUser.user.id,
    sessionUser.user.systemRole
  )
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
