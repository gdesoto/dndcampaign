import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { EncounterStatBlockService } from '#server/services/encounter/encounter-stat-block.service'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.read')
  const result = await new EncounterStatBlockService().listStatBlocks(campaignId)
  return ok(result)
})
