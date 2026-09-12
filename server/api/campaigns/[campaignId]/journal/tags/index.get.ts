import { validateQuery } from '#server/utils/validate'
import { fail, respond } from '#server/utils/http'
import { campaignJournalTagListQuerySchema } from '#shared/schemas/campaign-journal'
import { CampaignJournalService } from '#server/services/campaign-journal.service'

const campaignJournalService = new CampaignJournalService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const parsedQuery = validateQuery(event, campaignJournalTagListQuerySchema, 'Invalid journal tag query parameters')
  if (!parsedQuery.ok) return parsedQuery.response

  const sessionUser = await requireUserSession(event)
  const result = await campaignJournalService.listTags(
    campaignId,
    sessionUser.user.id,
    parsedQuery.data,
    sessionUser.user.systemRole
  )
  return respond(event, result)
})

