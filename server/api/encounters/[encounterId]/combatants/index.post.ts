import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterCombatantCreateSchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const { encounterId } = routeParams(event, 'encounterId')

  const parsed = await validateBody(event, encounterCombatantCreateSchema, 'Invalid combatant payload')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterService().createCombatant(encounterId, sessionUser.user.id, parsed)
  return ok(result)
})