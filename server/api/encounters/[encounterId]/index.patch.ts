import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterUpdateSchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

const lifecycleActions = new Set(['start', 'pause', 'resume', 'complete', 'abandon', 'reset'])

export default defineEventHandler(async (event) => {
  const { encounterId } = routeParams(event, 'encounterId')

  const rawBody = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  const action = typeof rawBody?.action === 'string' ? rawBody.action : null
  if (action && lifecycleActions.has(action)) {
    const sessionUser = await requireUserSession(event)
    const result = await new EncounterRuntimeService().transitionStatus(
      encounterId,
      sessionUser.user.id,
      action as 'start' | 'pause' | 'resume' | 'complete' | 'abandon' | 'reset',
    )

    return ok(result)
  }

  const parsed = await validateBody(event, encounterUpdateSchema, 'Invalid encounter payload')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterService().updateEncounter(encounterId, sessionUser.user.id, parsed)

  return ok(result)
})
