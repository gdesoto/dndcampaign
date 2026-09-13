import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { campaignJournalCreateSchema } from '#shared/schemas/campaign-journal'
import { CampaignJournalService } from '#server/services/campaign-journal.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const campaignJournalService = new CampaignJournalService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const parsed = await validateBody(event, campaignJournalCreateSchema, 'Invalid journal create payload')

  const { session, access } = await requireCampaignPermission(event, campaignId, 'campaign.read')
  const result = await campaignJournalService.createEntry(access,
    session.user.id,
    parsed
  )
  return ok(result)
})

