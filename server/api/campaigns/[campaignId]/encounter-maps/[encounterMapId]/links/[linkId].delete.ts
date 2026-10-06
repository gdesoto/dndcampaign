import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { EncounterMapEditorService } from '#server/services/encounter-map/encounter-map-editor.service'

const encounterMapEditorService = new EncounterMapEditorService()

export default defineEventHandler(async (event) => {
  const { campaignId, encounterMapId, linkId } = routeParams(event, 'campaignId', 'encounterMapId', 'linkId')

  await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await encounterMapEditorService.deleteLink(campaignId, encounterMapId, linkId)
  return ok(result)
})
