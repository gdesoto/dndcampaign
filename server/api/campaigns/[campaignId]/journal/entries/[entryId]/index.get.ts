import { ok, routeParams } from '#server/utils/http'
import { CampaignJournalService } from '#server/services/campaign-journal.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const campaignJournalService = new CampaignJournalService()

export default defineEventHandler(async (event) => {
  const { campaignId, entryId } = routeParams(event, 'campaignId', 'entryId')

  const { session, access } = await requireCampaignPermission(event, campaignId, 'campaign.read')
  const result = await campaignJournalService.getEntryById(access,
    entryId,
    session.user.id
  )
  return ok(result)
})

