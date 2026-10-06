import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { EncounterMapService } from '#server/services/encounter-map/encounter-map.service'

const encounterMapService = new EncounterMapService()

export default defineEventHandler(async (event) => {
  const { campaignId, encounterMapId } = routeParams(event, 'campaignId', 'encounterMapId')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.read')
  const result = await encounterMapService.getEncounterMap(campaignId, encounterMapId, actor)
  return ok(result)
})
