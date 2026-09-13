import { validateQuery } from '#server/utils/validate'
import { ok, routeParams } from '#server/utils/http'
import { campaignJournalListQuerySchema } from '#shared/schemas/campaign-journal'
import { CampaignJournalService } from '#server/services/campaign-journal.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const campaignJournalService = new CampaignJournalService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const parsedQuery = validateQuery(event, campaignJournalListQuerySchema, 'Invalid journal query parameters')

  const { session, access } = await requireCampaignPermission(event, campaignId, 'campaign.read')
  const result = await campaignJournalService.listEntries(access,
    session.user.id,
    parsedQuery
  )
  return ok(result)
})

