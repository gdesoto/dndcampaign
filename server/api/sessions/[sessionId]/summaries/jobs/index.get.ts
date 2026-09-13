import { ok, routeParams } from '#server/utils/http'
import { SummaryService } from '#server/services/summary.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { sessionId } = routeParams(event, 'sessionId')
  return ok(await new SummaryService().getJobsForSession(sessionId, sessionUser.user.id))
})
