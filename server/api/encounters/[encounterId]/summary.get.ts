import { ok, routeParams } from '#server/utils/http'
import { EncounterSummaryService } from '#server/services/encounter/encounter-summary.service'

export default defineEventHandler(async (event) => {
  const { encounterId } = routeParams(event, 'encounterId')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterSummaryService().getSummary(encounterId, sessionUser.user.id)
  return ok(result)
})