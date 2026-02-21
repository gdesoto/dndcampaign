import { getQuery } from 'h3'
import { fail, ok } from '#server/utils/http'
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

  const parsed = calendarEventQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid calendar events query')
  }

  const result = await calendarEventsService.listEvents(campaignId, authz.session.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
