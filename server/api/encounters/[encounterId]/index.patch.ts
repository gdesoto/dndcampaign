import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { encounterUpdateSchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

const lifecycleActions = new Set(['start', 'pause', 'resume', 'complete', 'abandon', 'reset'])

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  if (!encounterId) {
    return fail(event, 400, '', 'Encounter id is required')
  }

  const rawBody = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  const action = typeof rawBody?.action === 'string' ? rawBody.action : null
  if (action && lifecycleActions.has(action)) {
    const sessionUser = await requireUserSession(event)
    const result = await new EncounterRuntimeService().transitionStatus(
      encounterId,
      sessionUser.user.id,
      action as 'start' | 'pause' | 'resume' | 'complete' | 'abandon' | 'reset',
    )

    if (!result.ok) {
      return fail(event, result.statusCode, result.code, result.message, result.fields)
    }

    return ok(result.data)
  }

  const parsed = await readValidatedBodySafe(event, encounterUpdateSchema)
  if (!parsed.success) {
    return fail(event, 400, '', 'Invalid encounter payload', parsed.fieldErrors)
  }

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterService().updateEncounter(encounterId, sessionUser.user.id, parsed.data)

  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
