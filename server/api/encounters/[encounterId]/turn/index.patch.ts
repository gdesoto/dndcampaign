import { fail, respond } from '#server/utils/http'
import { validateInput } from '#server/utils/validate'
import { encounterSetActiveTurnSchema } from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

type TurnAction = 'advance' | 'rewind' | 'set-active'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  if (!encounterId) return fail(event, 400, 'VALIDATION_ERROR', 'Encounter id is required')

  const rawBody = ((await readBody(event).catch(() => ({}))) ?? {}) as Record<string, unknown>
  const action = rawBody.action as TurnAction | undefined
  if (!action || (action !== 'advance' && action !== 'rewind' && action !== 'set-active')) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid turn action', { action: 'Expected advance, rewind, or set-active' })
  }

  const sessionUser = await requireUserSession(event)
  const runtimeService = new EncounterRuntimeService()

  if (action === 'advance') {
    const result = await runtimeService.advanceTurn(encounterId, sessionUser.user.id)
    return respond(event, result)
  }

  if (action === 'rewind') {
    const result = await runtimeService.rewindTurn(encounterId, sessionUser.user.id)
    return respond(event, result)
  }

  const parsed = validateInput(event, encounterSetActiveTurnSchema, rawBody, 'Invalid turn payload')
  if (!parsed.ok) return parsed.response

  const result = await runtimeService.setActiveTurn(encounterId, sessionUser.user.id, parsed.data)
  return respond(event, result)
})
