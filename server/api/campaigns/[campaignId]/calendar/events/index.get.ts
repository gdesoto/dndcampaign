import { validateQuery } from '#server/utils/validate'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calendarEventQuerySchema } from '#shared/schemas/calendar'
import { CalendarEventsService } from '#server/services/calendar/calendar-events.service'

const calendarEventsService = new CalendarEventsService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'campaign.read')

  const parsed = validateQuery(event, calendarEventQuerySchema, 'Invalid calendar events query')

  const result = await calendarEventsService.listEvents(campaignId, parsed)
  return ok(result)
})

