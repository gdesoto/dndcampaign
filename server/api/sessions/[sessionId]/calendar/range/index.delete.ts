import { ok, routeParams } from '#server/utils/http'
import { SessionCalendarRangeService } from '#server/services/calendar/session-calendar-range.service'

const sessionCalendarRangeService = new SessionCalendarRangeService()

export default defineEventHandler(async (event) => {
  const { sessionId } = routeParams(event, 'sessionId')

  const sessionUser = await requireUserSession(event)

  const result = await sessionCalendarRangeService.deleteRange(sessionId, sessionUser.user.id)
  return ok(result)
})
