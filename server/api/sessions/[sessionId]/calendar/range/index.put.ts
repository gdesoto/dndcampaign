import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { sessionCalendarRangeWriteSchema } from '#shared/schemas/calendar'
import { SessionCalendarRangeService } from '#server/services/calendar/session-calendar-range.service'

const sessionCalendarRangeService = new SessionCalendarRangeService()

export default defineEventHandler(async (event) => {
  const { sessionId } = routeParams(event, 'sessionId')

  const sessionUser = await requireUserSession(event)

  const parsed = await validateBody(event, sessionCalendarRangeWriteSchema, 'Invalid session calendar range payload')

  const result = await sessionCalendarRangeService.upsertRange(sessionId, sessionUser.user.id, parsed)
  return ok(result)
})
