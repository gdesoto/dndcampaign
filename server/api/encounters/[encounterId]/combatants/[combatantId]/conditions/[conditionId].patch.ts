import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterConditionUpdateSchema } from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  const combatantId = event.context.params?.combatantId
  const conditionId = event.context.params?.conditionId
  if (!encounterId || !combatantId || !conditionId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Encounter id, combatant id, and condition id are required')
  }

  const parsed = await validateBody(event, encounterConditionUpdateSchema, 'Invalid condition payload')
  if (!parsed.ok) return parsed.response

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterRuntimeService().updateCondition(encounterId, combatantId, conditionId, sessionUser.user.id, parsed.data)
  return respond(event, result)
})