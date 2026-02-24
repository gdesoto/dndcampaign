import { ok, fail } from '#server/utils/http'
import { encounterInitiativeRollSchema } from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  if (!encounterId) return fail(event, 400, '', 'Encounter id is required')

  const rawBody = (await readBody(event).catch(() => ({}))) || {}
  const parsed = encounterInitiativeRollSchema.safeParse(rawBody)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'mode'
      fields[key] = issue.message
    }
    return fail(event, 400, '', 'Invalid initiative roll payload', fields)
  }

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterRuntimeService().rollInitiative(encounterId, sessionUser.user.id, parsed.data)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})
