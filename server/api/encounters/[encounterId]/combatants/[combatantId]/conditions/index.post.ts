import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterConditionCreateSchema } from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

export default defineEventHandler(async (event) => {
  const { encounterId, combatantId } = routeParams(event, 'encounterId', 'combatantId')

  const parsed = await validateBody(event, encounterConditionCreateSchema, 'Invalid condition payload')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterRuntimeService().createCondition(encounterId, combatantId, sessionUser.user.id, parsed)
  return ok(result)
})