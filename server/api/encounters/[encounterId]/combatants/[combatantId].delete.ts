import { fail, respond } from '#server/utils/http'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  const combatantId = event.context.params?.combatantId
  if (!encounterId || !combatantId) return fail(event, 400, 'VALIDATION_ERROR', 'Encounter id and combatant id are required')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterService().deleteCombatant(encounterId, combatantId, sessionUser.user.id)
  return respond(event, result)
})