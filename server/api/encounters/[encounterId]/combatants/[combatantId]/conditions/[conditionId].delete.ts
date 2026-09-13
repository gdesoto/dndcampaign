import { ok, routeParams } from '#server/utils/http'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

export default defineEventHandler(async (event) => {
  const { encounterId, combatantId, conditionId } = routeParams(event, 'encounterId', 'combatantId', 'conditionId')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterRuntimeService().deleteCondition(encounterId, combatantId, conditionId, sessionUser.user.id)
  return ok(result)
})