import { ok, fail } from '#server/utils/http'
import { SummaryService } from '#server/services/summary.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const sessionId = event.context.params?.sessionId
  if (!sessionId) return fail(event, 400, 'VALIDATION_ERROR', 'Session id is required')
  return ok(await new SummaryService().getJobsForSession(sessionId, sessionUser.user.id))
})
