import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterConditionCreateSchema } from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  const combatantId = event.context.params?.combatantId
  if (!encounterId || !combatantId) return fail(event, 400, 'VALIDATION_ERROR', 'Encounter id and combatant id are required')

  const parsed = await validateBody(event, encounterConditionCreateSchema, 'Invalid condition payload')
  if (!parsed.ok) return parsed.response

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterRuntimeService().createCondition(encounterId, combatantId, sessionUser.user.id, parsed.data)
  return respond(event, result)
})