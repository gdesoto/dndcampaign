import { getQuery } from 'h3'
import { MapService } from '#server/services/map.service'
import { ok, fail } from '#server/utils/http'
import { mapFeatureFilterSchema } from '#shared/schemas/map'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  const mapId = event.context.params?.mapId
  if (!campaignId || !mapId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id and map id are required')
  }

  const query = getQuery(event)
  const types = typeof query.types === 'string' ? query.types.split(',').map((entry) => entry.trim()) : undefined
  const parsed = mapFeatureFilterSchema.safeParse({
    types: types?.length ? types : undefined,
    includeRemoved: query.includeRemoved,
  })
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid feature filter payload')
  }

  const features = await new MapService().getFeatures(campaignId, mapId, session.user.id, parsed.data)
  if (!features) {
    return fail(404, 'NOT_FOUND', 'Map not found')
  }
  return ok(features)
})
