import { MapService } from '#server/services/map.service'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  const mapId = event.context.params?.mapId
  if (!campaignId || !mapId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id and map id are required')
  }

  const viewer = await new MapService().getViewer(campaignId, mapId, session.user.id)
  if (!viewer) {
    return fail(404, 'NOT_FOUND', 'Map not found')
  }
  return ok(viewer)
})
