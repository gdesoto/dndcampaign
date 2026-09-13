import { validateQuery } from '#server/utils/validate'
import { ok, routeParams } from '#server/utils/http'
import { publicCampaignJournalListQuerySchema } from '#shared/schemas/campaign-journal'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const { publicSlug } = routeParams(event, 'publicSlug')

  const parsedQuery = validateQuery(event, publicCampaignJournalListQuerySchema, 'Invalid public journal query parameters')

  const result = await publicAccessService.getPublicJournalEntries(publicSlug, parsedQuery)
  return ok(result)
})

