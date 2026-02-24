import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { encounterConditionUpdateSchema } from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  const combatantId = event.context.params?.combatantId
  const conditionId = event.context.params?.conditionId
  if (!encounterId || !combatantId || !conditionId) {
    return fail(event, 400, '', 'Encounter id, combatant id, and condition id are required')
  }

  const parsed = await readValidatedBodySafe(event, encounterConditionUpdateSchema)
  if (!parsed.success) return fail(event, 400, '', 'Invalid condition payload', parsed.fieldErrors)

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterRuntimeService().updateCondition(encounterId, combatantId, conditionId, sessionUser.user.id, parsed.data)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})