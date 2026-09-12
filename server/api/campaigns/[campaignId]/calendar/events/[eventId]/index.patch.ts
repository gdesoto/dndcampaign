import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calendarEventUpdateSchema } from '#shared/schemas/calendar'
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

  const parsed = await validateBody(event, calendarEventUpdateSchema, 'Invalid calendar event payload')
  if (!parsed.ok) return parsed.response

  const result = await calendarEventsService.updateEvent(campaignId, eventId, authz.session.user.id, parsed.data)
  return respond(event, result)
})

