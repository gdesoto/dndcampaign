import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { encounterMapLinkCreateSchema } from '#shared/schemas/encounter-map'
import { EncounterMapEditorService } from '#server/services/encounter-map/encounter-map-editor.service'

const encounterMapEditorService = new EncounterMapEditorService()

export default defineEventHandler(async (event) => {
  const { campaignId, encounterMapId } = routeParams(event, 'campaignId', 'encounterMapId')

  const parsed = await validateBody(event, encounterMapLinkCreateSchema, 'Invalid encounter map link payload')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await encounterMapEditorService.createLink(campaignId, encounterMapId, actor, parsed)
  return ok(result)
})
