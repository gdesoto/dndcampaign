import { fail, respond } from '#server/utils/http'
import { EncounterSummaryService } from '#server/services/encounter/encounter-summary.service'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  if (!encounterId) return fail(event, 400, 'VALIDATION_ERROR', 'Encounter id is required')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterSummaryService().getSummary(encounterId, sessionUser.user.id)
  return respond(event, result)
})