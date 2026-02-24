import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { encounterEventNoteCreateSchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  if (!encounterId) return fail(event, 400, '', 'Encounter id is required')

  const parsed = await readValidatedBodySafe(event, encounterEventNoteCreateSchema)
  if (!parsed.success) return fail(event, 400, '', 'Invalid event note payload', parsed.fieldErrors)

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterService().createNoteEvent(encounterId, sessionUser.user.id, parsed.data)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})