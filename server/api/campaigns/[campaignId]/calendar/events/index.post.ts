import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calendarEventCreateSchema } from '#shared/schemas/calendar'
import { CalendarEventsService } from '#server/services/calendar/calendar-events.service'

const calendarEventsService = new CalendarEventsService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.update')

  const parsed = await validateBody(event, calendarEventCreateSchema, 'Invalid calendar event payload')

  const result = await calendarEventsService.createEvent(campaignId, authz.session.user.id, parsed)
  return ok(result)
})

