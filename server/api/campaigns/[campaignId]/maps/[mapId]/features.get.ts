import { getQuery } from 'h3'
import { MapService } from '#server/services/map.service'
import { ok, fail } from '#server/utils/http'
import { mapFeatureFilterSchema } from '#shared/schemas/map'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const mapId = event.context.params?.mapId
  if (!campaignId || !mapId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id and map id are required')
  }
  const authz = await requireCampaignPermission(event, campaignId, 'content.read')
  if (!authz.ok) return authz.response

  const query = getQuery(event)
  const types = typeof query.types === 'string' ? query.types.split(',').map((entry) => entry.trim()) : undefined
  const parsed = mapFeatureFilterSchema.safeParse({
    types: types?.length ? types : undefined,
    includeRemoved: query.includeRemoved,
  })
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid feature filter payload')
  }

  const features = await new MapService().getFeatures(campaignId, mapId, authz.session.user.id, parsed.data)
  if (!features) {
    return fail(404, 'NOT_FOUND', 'Map not found')
  }
  return ok(features)
})
