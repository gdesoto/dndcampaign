import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { encounterCreateSchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const parsed = await validateBody(event, encounterCreateSchema, 'Invalid encounter payload')

  const { session } = await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await new EncounterService().createEncounter(campaignId, session.user.id, parsed)

  return ok(result)
})