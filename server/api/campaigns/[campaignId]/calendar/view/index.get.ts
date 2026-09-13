import { validateQuery } from '#server/utils/validate'
import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calendarViewQuerySchema } from '#shared/schemas/calendar'
import { CalendarConfigService } from '#server/services/calendar/calendar-config.service'
import { CalendarEventsService } from '#server/services/calendar/calendar-events.service'
import { SessionCalendarRangeService } from '#server/services/calendar/session-calendar-range.service'

const calendarConfigService = new CalendarConfigService()
const calendarEventsService = new CalendarEventsService()
const sessionCalendarRangeService = new SessionCalendarRangeService()

type DateParts = { year: number, month: number, day: number }

const compareDateParts = (left: DateParts, right: DateParts) => {
  if (left.year !== right.year) return left.year - right.year
  if (left.month !== right.month) return left.month - right.month
  return left.day - right.day
}

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'campaign.read')

  const parsedQuery = validateQuery(event, calendarViewQuerySchema, 'Invalid calendar view query')

  const configResult = await calendarConfigService.getConfig(campaignId)

  const config = configResult
  if (!config || !config.isEnabled) {
    return ok({
      config,
      currentDate: config
        ? { year: config.currentYear, month: config.currentMonth, day: config.currentDay }
        : null,
      selectedMonth: null,
      events: [],
      sessionRanges: [],
    })
  }

  const selectedYear = parsedQuery.year ?? config.currentYear
  const selectedMonth = parsedQuery.month ?? config.currentMonth
  const selectedMonthDefinition = config.months[selectedMonth - 1]
  if (!selectedMonthDefinition) {
    throw apiError(400, 'VALIDATION_ERROR', `Month must be between 1 and ${config.months.length}`)
  }

  const eventsResult = await calendarEventsService.listEvents(campaignId, {
    year: selectedYear,
    month: selectedMonth,
  })

  const rangesResult = await sessionCalendarRangeService.listRanges(campaignId)

  const sessions = await prisma.session.findMany({
    where: { campaignId },
    select: {
      id: true,
      title: true,
      sessionNumber: true,
      playedAt: true,
    },
  })
  const sessionById = new Map(sessions.map((session) => [session.id, session]))

  const monthStart: DateParts = { year: selectedYear, month: selectedMonth, day: 1 }
  const monthEnd: DateParts = { year: selectedYear, month: selectedMonth, day: selectedMonthDefinition.length }
  const intersectingRanges = rangesResult
    .filter((range) => {
      const rangeStart: DateParts = {
        year: range.startYear,
        month: range.startMonth,
        day: range.startDay,
      }
      const rangeEnd: DateParts = {
        year: range.endYear,
        month: range.endMonth,
        day: range.endDay,
      }
      return compareDateParts(rangeStart, monthEnd) <= 0 && compareDateParts(rangeEnd, monthStart) >= 0
    })
    .map((range) => ({
      ...range,
      session: (() => {
        const session = sessionById.get(range.sessionId)
        if (!session) return null
        return {
          id: session.id,
          title: session.title,
          sessionNumber: session.sessionNumber,
          playedAt: session.playedAt?.toISOString() ?? null,
        }
      })(),
    }))

  return ok({
    config,
    currentDate: {
      year: config.currentYear,
      month: config.currentMonth,
      day: config.currentDay,
    },
    selectedMonth: {
      year: selectedYear,
      month: selectedMonth,
      index: selectedMonth - 1,
      name: selectedMonthDefinition.name,
      length: selectedMonthDefinition.length,
    },
    events: eventsResult,
    sessionRanges: intersectingRanges,
  })
})

