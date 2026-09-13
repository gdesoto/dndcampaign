import { validateQuery } from '#server/utils/validate'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { encounterListQuerySchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.read')
  const parsedQuery = validateQuery(event, encounterListQuerySchema, 'Invalid encounter query parameters')

  const result = await new EncounterService().listEncounters(campaignId, parsedQuery)
  return ok(result)
})