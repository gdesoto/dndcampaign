import { fail, respond } from '#server/utils/http'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  if (!encounterId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Encounter id is required')
  }

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterService().deleteEncounter(encounterId, sessionUser.user.id)

  return respond(event, result)
})