import { validateQuery } from '#server/utils/validate'
import { fail, respond } from '#server/utils/http'
import { publicCampaignJournalListQuerySchema } from '#shared/schemas/campaign-journal'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const publicSlug = event.context.params?.publicSlug
  if (!publicSlug) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Public slug is required')
  }

  const parsedQuery = validateQuery(event, publicCampaignJournalListQuerySchema, 'Invalid public journal query parameters')
  if (!parsedQuery.ok) return parsedQuery.response

  const result = await publicAccessService.getPublicJournalEntries(publicSlug, parsedQuery.data)
  return respond(event, result)
})

