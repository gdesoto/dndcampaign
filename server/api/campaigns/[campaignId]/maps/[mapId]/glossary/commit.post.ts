import { MapService } from '#server/services/map.service'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { mapGlossaryCommitSchema } from '#shared/schemas/map'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  const mapId = event.context.params?.mapId
  if (!campaignId || !mapId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id and map id are required')
  }

  const parsed = await readValidatedBodySafe(event, mapGlossaryCommitSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid glossary commit payload', parsed.fieldErrors)
  }

  const result = await new MapService().commitGlossary(
    campaignId,
    mapId,
    session.user.id,
    parsed.data.items
  )
  if (!result) {
    return fail(404, 'NOT_FOUND', 'Map not found')
  }
  return ok(result)
})
