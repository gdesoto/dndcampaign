import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { campaignJournalCreateSchema } from '#shared/schemas/campaign-journal'
import { CampaignJournalService } from '#server/services/campaign-journal.service'

const campaignJournalService = new CampaignJournalService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const parsed = await validateBody(event, campaignJournalCreateSchema, 'Invalid journal create payload')
  if (!parsed.ok) return parsed.response

  const sessionUser = await requireUserSession(event)
  const result = await campaignJournalService.createEntry(
    campaignId,
    sessionUser.user.id,
    parsed.data,
    sessionUser.user.systemRole
  )
  return respond(event, result)
})

