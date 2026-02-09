import { MapService } from '#server/services/map.service'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { mapGlossaryStageSchema } from '#shared/schemas/map'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  const mapId = event.context.params?.mapId
  if (!campaignId || !mapId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id and map id are required')
  }

  const parsed = await readValidatedBodySafe(event, mapGlossaryStageSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid glossary stage payload', parsed.fieldErrors)
  }

  const staged = await new MapService().stageGlossary(
    campaignId,
    mapId,
    session.user.id,
    parsed.data.featureIds
  )
  if (!staged) {
    return fail(404, 'NOT_FOUND', 'Map not found')
  }
  return ok(staged)
})
