import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterConditionUpdateSchema } from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

export default defineEventHandler(async (event) => {
  const { encounterId, combatantId, conditionId } = routeParams(event, 'encounterId', 'combatantId', 'conditionId')

  const parsed = await validateBody(event, encounterConditionUpdateSchema, 'Invalid condition payload')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterRuntimeService().updateCondition(encounterId, combatantId, conditionId, sessionUser.user.id, parsed)
  return ok(result)
})