import { fail, ok } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { CalendarEventsService } from '#server/services/calendar/calendar-events.service'

const calendarEventsService = new CalendarEventsService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const eventId = event.context.params?.eventId
  if (!campaignId || !eventId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and event id are required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.update')
  if (!authz.ok) {
    return authz.response
  }

  const result = await calendarEventsService.deleteEvent(campaignId, eventId, authz.session.user.id)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
