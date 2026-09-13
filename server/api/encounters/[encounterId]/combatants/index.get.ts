import { ok, routeParams } from '#server/utils/http'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const { encounterId } = routeParams(event, 'encounterId')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterService().listCombatants(encounterId, sessionUser.user.id)
  return ok(result)
})