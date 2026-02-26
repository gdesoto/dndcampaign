import { getQuery } from 'h3'
import { fail, ok } from '#server/utils/http'
import { publicCampaignJournalListQuerySchema } from '#shared/schemas/campaign-journal'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const publicSlug = event.context.params?.publicSlug
  if (!publicSlug) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Public slug is required')
  }

  const parsedQuery = publicCampaignJournalListQuerySchema.safeParse(getQuery(event))
  if (!parsedQuery.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid public journal query parameters')
  }

  const result = await publicAccessService.getPublicJournalEntries(publicSlug, parsedQuery.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
