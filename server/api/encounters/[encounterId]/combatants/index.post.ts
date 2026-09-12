import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterCombatantCreateSchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  if (!encounterId) return fail(event, 400, 'VALIDATION_ERROR', 'Encounter id is required')

  const parsed = await validateBody(event, encounterCombatantCreateSchema, 'Invalid combatant payload')
  if (!parsed.ok) return parsed.response

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterService().createCombatant(encounterId, sessionUser.user.id, parsed.data)
  return respond(event, result)
})