import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { sessionCalendarRangeWriteSchema } from '#shared/schemas/calendar'
import { SessionCalendarRangeService } from '#server/services/calendar/session-calendar-range.service'

const sessionCalendarRangeService = new SessionCalendarRangeService()

export default defineEventHandler(async (event) => {
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const sessionUser = await requireUserSession(event)

  const parsed = await validateBody(event, sessionCalendarRangeWriteSchema, 'Invalid session calendar range payload')
  if (!parsed.ok) return parsed.response

  const result = await sessionCalendarRangeService.upsertRange(sessionId, sessionUser.user.id, parsed.data)
  return respond(event, result)
})
