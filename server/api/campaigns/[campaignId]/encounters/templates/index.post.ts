import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { encounterTemplateCreateSchema } from '#shared/schemas/encounter'
import { EncounterTemplateService } from '#server/services/encounter/encounter-template.service'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const parsed = await validateBody(event, encounterTemplateCreateSchema, 'Invalid template payload')

  const { session } = await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await new EncounterTemplateService().createTemplate(campaignId, session.user.id, parsed)
  return ok(result)
})
