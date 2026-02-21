import { fail, ok } from '#server/utils/http'
import { SessionCalendarRangeService } from '#server/services/calendar/session-calendar-range.service'

const sessionCalendarRangeService = new SessionCalendarRangeService()

export default defineEventHandler(async (event) => {
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const sessionUser = await requireUserSession(event)

  const result = await sessionCalendarRangeService.deleteRange(sessionId, sessionUser.user.id)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
