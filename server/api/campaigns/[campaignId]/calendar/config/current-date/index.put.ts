import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calendarCurrentDateUpdateSchema } from '#shared/schemas/calendar'
import { CalendarConfigService } from '#server/services/calendar/calendar-config.service'

const calendarConfigService = new CalendarConfigService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'campaign.update')

  const parsed = await validateBody(event, calendarCurrentDateUpdateSchema, 'Invalid current date payload')

  const result = await calendarConfigService.updateCurrentDate(campaignId, parsed)
  return ok(result)
})

