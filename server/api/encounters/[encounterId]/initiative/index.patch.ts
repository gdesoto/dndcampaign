import { ok, fail } from '#server/utils/http'
import {
  encounterInitiativeReorderSchema,
  encounterInitiativeRollSchema,
} from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

type InitiativeAction = 'roll' | 'reorder'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  if (!encounterId) return fail(event, 400, '', 'Encounter id is required')

  const rawBody = ((await readBody(event).catch(() => ({}))) ?? {}) as Record<string, unknown>
  const action = rawBody.action as InitiativeAction | undefined
  if (!action || (action !== 'roll' && action !== 'reorder')) {
    return fail(event, 400, '', 'Invalid initiative action', { action: 'Expected roll or reorder' })
  }

  const sessionUser = await requireUserSession(event)
  const runtimeService = new EncounterRuntimeService()

  if (action === 'roll') {
    const parsed = encounterInitiativeRollSchema.safeParse(rawBody)
    if (!parsed.success) {
      const fields: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'mode'
        fields[key] = issue.message
      }
      return fail(event, 400, '', 'Invalid initiative roll payload', fields)
    }

    const result = await runtimeService.rollInitiative(encounterId, sessionUser.user.id, parsed.data)
    if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)
    return ok(result.data)
  }

  const parsed = encounterInitiativeReorderSchema.safeParse(rawBody)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'combatantOrder'
      fields[key] = issue.message
    }
    return fail(event, 400, '', 'Invalid reorder payload', fields)
  }

  const result = await runtimeService.reorderInitiative(encounterId, sessionUser.user.id, parsed.data)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)
  return ok(result.data)
})
