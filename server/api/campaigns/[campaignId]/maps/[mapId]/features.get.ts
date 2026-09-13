import { getQuery } from 'h3'
import { MapService } from '#server/services/map.service'
import { ok, apiError, routeParams } from '#server/utils/http'
import { mapFeatureFilterSchema } from '#shared/schemas/map'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId, mapId } = routeParams(event, 'campaignId', 'mapId')
  await requireCampaignPermission(event, campaignId, 'content.read')

  const query = getQuery(event)
  const types = typeof query.types === 'string' ? query.types.split(',').map((entry) => entry.trim()) : undefined
  const parsed = mapFeatureFilterSchema.safeParse({
    types: types?.length ? types : undefined,
    includeRemoved: query.includeRemoved,
  })
  if (!parsed.success) {
    throw apiError(400, 'VALIDATION_ERROR', 'Invalid feature filter payload')
  }

  const features = await new MapService().getFeatures(campaignId, mapId, parsed.data)
  if (!features) {
    throw apiError(404, 'NOT_FOUND', 'Map not found')
  }
  return ok(features)
})
