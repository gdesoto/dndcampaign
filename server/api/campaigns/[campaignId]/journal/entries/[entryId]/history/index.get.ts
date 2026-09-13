import { validateQuery } from '#server/utils/validate'
import { ok, routeParams } from '#server/utils/http'
import { campaignJournalHistoryListQuerySchema } from '#shared/schemas/campaign-journal'
import { CampaignJournalService } from '#server/services/campaign-journal.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const campaignJournalService = new CampaignJournalService()

export default defineEventHandler(async (event) => {
  const { campaignId, entryId } = routeParams(event, 'campaignId', 'entryId')

  const parsedQuery = validateQuery(event, campaignJournalHistoryListQuerySchema, 'Invalid history query parameters')

  const { session, access } = await requireCampaignPermission(event, campaignId, 'campaign.read')
  const result = await campaignJournalService.listEntryHistory(access,
    entryId,
    session.user.id,
    parsedQuery
  )
  return ok(result)
})

