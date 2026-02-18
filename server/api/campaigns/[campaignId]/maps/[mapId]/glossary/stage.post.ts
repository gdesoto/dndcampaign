import { MapService } from '#server/services/map.service'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { mapGlossaryStageSchema } from '#shared/schemas/map'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const mapId = event.context.params?.mapId
  if (!campaignId || !mapId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id and map id are required')
  }
  const authz = await requireCampaignPermission(event, campaignId, 'content.write')
  if (!authz.ok) return authz.response

  const parsed = await readValidatedBodySafe(event, mapGlossaryStageSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid glossary stage payload', parsed.fieldErrors)
  }

  const staged = await new MapService().stageGlossary(
    campaignId,
    mapId,
    authz.session.user.id,
    parsed.data.featureIds
  )
  if (!staged) {
    return fail(404, 'NOT_FOUND', 'Map not found')
  }
  return ok(staged)
})
