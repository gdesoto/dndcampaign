import { validateQuery } from '#server/utils/validate'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { encounterMapListQuerySchema } from '#shared/schemas/encounter-map'
import { EncounterMapService } from '#server/services/encounter-map/encounter-map.service'

const encounterMapService = new EncounterMapService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.read')
  const query = validateQuery(event, encounterMapListQuerySchema, 'Invalid encounter map query parameters')

  const result = await encounterMapService.listEncounterMaps(campaignId, actor, query)
  return ok(result)
})
