import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { encounterCombatantUpdateSchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  const combatantId = event.context.params?.combatantId
  if (!encounterId || !combatantId) return fail(event, 400, '', 'Encounter id and combatant id are required')

  const parsed = await readValidatedBodySafe(event, encounterCombatantUpdateSchema)
  if (!parsed.success) return fail(event, 400, '', 'Invalid combatant payload', parsed.fieldErrors)

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterService().updateCombatant(encounterId, combatantId, sessionUser.user.id, parsed.data)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})