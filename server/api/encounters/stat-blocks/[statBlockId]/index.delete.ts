import { ok, routeParams } from '#server/utils/http'
import { EncounterStatBlockService } from '#server/services/encounter/encounter-stat-block.service'

export default defineEventHandler(async (event) => {
  const { statBlockId } = routeParams(event, 'statBlockId')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterStatBlockService().deleteStatBlock(statBlockId, sessionUser.user.id)
  return ok(result)
})
