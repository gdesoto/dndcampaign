import { fail, ok } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { sessionCalendarRangeWriteSchema } from '#shared/schemas/calendar'
import { SessionCalendarRangeService } from '#server/services/calendar/session-calendar-range.service'

const sessionCalendarRangeService = new SessionCalendarRangeService()

export default defineEventHandler(async (event) => {
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const sessionUser = await requireUserSession(event)

  const parsed = await readValidatedBodySafe(event, sessionCalendarRangeWriteSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid session calendar range payload', parsed.fieldErrors)
  }

  const result = await sessionCalendarRangeService.upsertRange(sessionId, sessionUser.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
