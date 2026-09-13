import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { CalendarConfigService } from '#server/services/calendar/calendar-config.service'

const calendarConfigService = new CalendarConfigService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'campaign.read')

  const result = await calendarConfigService.getConfig(campaignId)
  return ok(result)
})

