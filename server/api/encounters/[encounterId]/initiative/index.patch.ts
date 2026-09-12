import { fail, respond } from '#server/utils/http'
import { validateInput } from '#server/utils/validate'
import {
  encounterInitiativeReorderSchema,
  encounterInitiativeRollSchema,
} from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

type InitiativeAction = 'roll' | 'reorder'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  if (!encounterId) return fail(event, 400, 'VALIDATION_ERROR', 'Encounter id is required')

  const rawBody = ((await readBody(event).catch(() => ({}))) ?? {}) as Record<string, unknown>
  const action = rawBody.action as InitiativeAction | undefined
  if (!action || (action !== 'roll' && action !== 'reorder')) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid initiative action', { action: 'Expected roll or reorder' })
  }

  const sessionUser = await requireUserSession(event)
  const runtimeService = new EncounterRuntimeService()

  if (action === 'roll') {
    const parsed = validateInput(event, encounterInitiativeRollSchema, rawBody, 'Invalid initiative roll payload')
    if (!parsed.ok) return parsed.response

    const result = await runtimeService.rollInitiative(encounterId, sessionUser.user.id, parsed.data)
    return respond(event, result)
  }

  const parsed = validateInput(event, encounterInitiativeReorderSchema, rawBody, 'Invalid reorder payload')
  if (!parsed.ok) return parsed.response

  const result = await runtimeService.reorderInitiative(encounterId, sessionUser.user.id, parsed.data)
  return respond(event, result)
})
