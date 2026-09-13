import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { EncounterTemplateService } from '#server/services/encounter/encounter-template.service'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.read')
  const result = await new EncounterTemplateService().listTemplates(campaignId)
  return ok(result)
})
