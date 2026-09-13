import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { CalendarEventsService } from '#server/services/calendar/calendar-events.service'

const calendarEventsService = new CalendarEventsService()

export default defineEventHandler(async (event) => {
  const { campaignId, eventId } = routeParams(event, 'campaignId', 'eventId')

  await requireCampaignPermission(event, campaignId, 'campaign.update')

  const result = await calendarEventsService.deleteEvent(campaignId, eventId)
  return ok(result)
})

