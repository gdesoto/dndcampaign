import { ok, fail } from '#server/utils/http'
import { EncounterSummaryService } from '#server/services/encounter/encounter-summary.service'

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  if (!encounterId) return fail(event, 400, '', 'Encounter id is required')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterSummaryService().getSummary(encounterId, sessionUser.user.id)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})