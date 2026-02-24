import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { encounterSetActiveTurnSchema } from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  if (!encounterId) return fail(event, 400, '', 'Encounter id is required')

  const parsed = await readValidatedBodySafe(event, encounterSetActiveTurnSchema)
  if (!parsed.success) return fail(event, 400, '', 'Invalid turn payload', parsed.fieldErrors)

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterRuntimeService().setActiveTurn(encounterId, sessionUser.user.id, parsed.data)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})