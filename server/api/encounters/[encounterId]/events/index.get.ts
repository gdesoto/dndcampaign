import { ok, routeParams } from '#server/utils/http'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const { encounterId } = routeParams(event, 'encounterId')

  const sessionUser = await requireApiUserSession(event)
  const result = await new EncounterService().listEvents(encounterId, sessionUser.user.id)
  return ok(result)
})
