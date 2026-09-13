import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calendarEventUpdateSchema } from '#shared/schemas/calendar'
import { CalendarEventsService } from '#server/services/calendar/calendar-events.service'

const calendarEventsService = new CalendarEventsService()

export default defineEventHandler(async (event) => {
  const { campaignId, eventId } = routeParams(event, 'campaignId', 'eventId')

  await requireCampaignPermission(event, campaignId, 'campaign.update')

  const parsed = await validateBody(event, calendarEventUpdateSchema, 'Invalid calendar event payload')

  const result = await calendarEventsService.updateEvent(campaignId, eventId, parsed)
  return ok(result)
})

