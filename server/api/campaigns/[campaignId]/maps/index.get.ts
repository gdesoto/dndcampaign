import { ok, fail } from '#server/utils/http'
import { MapService } from '#server/services/map.service'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const maps = await new MapService().listMaps(campaignId, session.user.id)
  if (!maps) {
    return fail(404, 'NOT_FOUND', 'Campaign not found')
  }

  return ok(maps)
})
