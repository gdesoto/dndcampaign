import { ok, routeParams } from '#server/utils/http'
import { CampaignJournalService } from '#server/services/campaign-journal.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const campaignJournalService = new CampaignJournalService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const { access } = await requireCampaignPermission(event, campaignId, 'campaign.read')
  const result = await campaignJournalService.listMemberOptions(access)
  return ok(result)
})

