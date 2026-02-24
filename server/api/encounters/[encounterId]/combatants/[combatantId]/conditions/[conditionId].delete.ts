import { ok, fail } from '#server/utils/http'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  const combatantId = event.context.params?.combatantId
  const conditionId = event.context.params?.conditionId
  if (!encounterId || !combatantId || !conditionId) {
    return fail(event, 400, '', 'Encounter id, combatant id, and condition id are required')
  }

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterRuntimeService().deleteCondition(encounterId, combatantId, conditionId, sessionUser.user.id)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})