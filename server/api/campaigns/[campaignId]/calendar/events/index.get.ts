import { validateQuery } from '#server/utils/validate'
import { fail, respond } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calendarEventQuerySchema } from '#shared/schemas/calendar'
import { CalendarEventsService } from '#server/services/calendar/calendar-events.service'

const calendarEventsService = new CalendarEventsService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.read')
  if (!authz.ok) {
    return authz.response
  }

  const parsed = validateQuery(event, calendarEventQuerySchema, 'Invalid calendar events query')
  if (!parsed.ok) return parsed.response

  const result = await calendarEventsService.listEvents(campaignId, authz.session.user.id, parsed.data)
  return respond(event, result)
})

