import { getQuery } from 'h3'
import { fail, ok } from '#server/utils/http'
import { campaignJournalTagSuggestQuerySchema } from '#shared/schemas/campaign-journal'
import { CampaignJournalService } from '#server/services/campaign-journal.service'

const campaignJournalService = new CampaignJournalService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const parsedQuery = campaignJournalTagSuggestQuerySchema.safeParse(getQuery(event))
  if (!parsedQuery.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid journal tag suggest query parameters')
  }

  const sessionUser = await requireUserSession(event)
  const result = await campaignJournalService.suggestTags(
    campaignId,
    sessionUser.user.id,
    parsedQuery.data,
    sessionUser.user.systemRole
  )
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
