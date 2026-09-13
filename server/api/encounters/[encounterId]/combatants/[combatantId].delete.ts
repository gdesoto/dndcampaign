import { ok, routeParams } from '#server/utils/http'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const { encounterId, combatantId } = routeParams(event, 'encounterId', 'combatantId')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterService().deleteCombatant(encounterId, combatantId, sessionUser.user.id)
  return ok(result)
})