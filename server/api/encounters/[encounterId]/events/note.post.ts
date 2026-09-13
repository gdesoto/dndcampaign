import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterEventNoteCreateSchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const { encounterId } = routeParams(event, 'encounterId')

  const parsed = await validateBody(event, encounterEventNoteCreateSchema, 'Invalid event note payload')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterService().createNoteEvent(encounterId, sessionUser.user.id, parsed)
  return ok(result)
})