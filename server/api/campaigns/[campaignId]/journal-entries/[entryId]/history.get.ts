import { getQuery } from 'h3'
import { fail, ok } from '#server/utils/http'
import { campaignJournalHistoryListQuerySchema } from '#shared/schemas/campaign-journal'
import { CampaignJournalService } from '#server/services/campaign-journal.service'

const campaignJournalService = new CampaignJournalService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const entryId = event.context.params?.entryId
  if (!campaignId || !entryId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and entry id are required')
  }

  const parsedQuery = campaignJournalHistoryListQuerySchema.safeParse(getQuery(event))
  if (!parsedQuery.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid history query parameters')
  }

  const sessionUser = await requireUserSession(event)
  const result = await campaignJournalService.listEntryHistory(
    campaignId,
    entryId,
    sessionUser.user.id,
    parsedQuery.data,
    sessionUser.user.systemRole
  )
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
