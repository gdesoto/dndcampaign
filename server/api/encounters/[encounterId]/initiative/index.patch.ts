import { ok, apiError, routeParams } from '#server/utils/http'
import { validateInput } from '#server/utils/validate'
import {
  encounterInitiativeReorderSchema,
  encounterInitiativeRollSchema,
} from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

type InitiativeAction = 'roll' | 'reorder'

export default defineEventHandler(async (event) => {
  const { encounterId } = routeParams(event, 'encounterId')

  const rawBody = ((await readBody(event).catch(() => ({}))) ?? {}) as Record<string, unknown>
  const action = rawBody.action as InitiativeAction | undefined
  if (!action || (action !== 'roll' && action !== 'reorder')) {
    throw apiError(400, 'VALIDATION_ERROR', 'Invalid initiative action', { action: 'Expected roll or reorder' })
  }

  const sessionUser = await requireUserSession(event)
  const runtimeService = new EncounterRuntimeService()

  if (action === 'roll') {
    const parsed = validateInput(encounterInitiativeRollSchema, rawBody, 'Invalid initiative roll payload')

    const result = await runtimeService.rollInitiative(encounterId, sessionUser.user.id, parsed)
    return ok(result)
  }

  const parsed = validateInput(encounterInitiativeReorderSchema, rawBody, 'Invalid reorder payload')

  const result = await runtimeService.reorderInitiative(encounterId, sessionUser.user.id, parsed)
  return ok(result)
})
