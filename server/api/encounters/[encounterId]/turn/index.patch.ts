import { ok, fail } from '#server/utils/http'
import { encounterSetActiveTurnSchema } from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

type TurnAction = 'advance' | 'rewind' | 'set-active'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  if (!encounterId) return fail(event, 400, '', 'Encounter id is required')

  const rawBody = ((await readBody(event).catch(() => ({}))) ?? {}) as Record<string, unknown>
  const action = rawBody.action as TurnAction | undefined
  if (!action || (action !== 'advance' && action !== 'rewind' && action !== 'set-active')) {
    return fail(event, 400, '', 'Invalid turn action', { action: 'Expected advance, rewind, or set-active' })
  }

  const sessionUser = await requireUserSession(event)
  const runtimeService = new EncounterRuntimeService()

  if (action === 'advance') {
    const result = await runtimeService.advanceTurn(encounterId, sessionUser.user.id)
    if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)
    return ok(result.data)
  }

  if (action === 'rewind') {
    const result = await runtimeService.rewindTurn(encounterId, sessionUser.user.id)
    if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)
    return ok(result.data)
  }

  const parsed = encounterSetActiveTurnSchema.safeParse(rawBody)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'combatantId'
      fields[key] = issue.message
    }
    return fail(event, 400, '', 'Invalid turn payload', fields)
  }

  const result = await runtimeService.setActiveTurn(encounterId, sessionUser.user.id, parsed.data)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)
  return ok(result.data)
})
