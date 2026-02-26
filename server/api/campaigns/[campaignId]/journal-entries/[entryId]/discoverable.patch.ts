import { fail, ok } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { campaignJournalDiscoverableUpdateSchema } from '#shared/schemas/campaign-journal'
import { CampaignJournalService } from '#server/services/campaign-journal.service'

const campaignJournalService = new CampaignJournalService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const entryId = event.context.params?.entryId
  if (!campaignId || !entryId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and entry id are required')
  }

  const parsed = await readValidatedBodySafe(event, campaignJournalDiscoverableUpdateSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid discoverable payload', parsed.fieldErrors)
  }

  const sessionUser = await requireUserSession(event)
  const result = await campaignJournalService.updateDiscoverable(
    campaignId,
    entryId,
    sessionUser.user.id,
    parsed.data,
    sessionUser.user.systemRole
  )
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
