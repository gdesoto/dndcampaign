import { validateQuery } from '#server/utils/validate'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calendarViewQuerySchema } from '#shared/schemas/calendar'
import { CalendarConfigService } from '#server/services/calendar/calendar-config.service'

const calendarConfigService = new CalendarConfigService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'campaign.read')

  const parsedQuery = validateQuery(event, calendarViewQuerySchema, 'Invalid calendar view query')

  return ok(await calendarConfigService.getMonthView(campaignId, parsedQuery))
})

