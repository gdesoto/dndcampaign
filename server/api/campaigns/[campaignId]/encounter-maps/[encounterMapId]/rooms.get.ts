import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { EncounterMapEditorService } from '#server/services/encounter-map/encounter-map-editor.service'

const encounterMapEditorService = new EncounterMapEditorService()

export default defineEventHandler(async (event) => {
  const { campaignId, encounterMapId } = routeParams(event, 'campaignId', 'encounterMapId')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.read')
  const result = await encounterMapEditorService.listRooms(campaignId, encounterMapId, actor)
  return ok(result)
})
