import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { encounterStatBlockCreateSchema } from '#shared/schemas/encounter'
import { EncounterStatBlockService } from '#server/services/encounter/encounter-stat-block.service'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const parsed = await validateBody(event, encounterStatBlockCreateSchema, 'Invalid stat block payload')

  const { session } = await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await new EncounterStatBlockService().createStatBlock(campaignId, session.user.id, parsed)
  return ok(result)
})
