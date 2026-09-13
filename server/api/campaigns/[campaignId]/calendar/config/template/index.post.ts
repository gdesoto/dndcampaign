import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calendarTemplateApplySchema } from '#shared/schemas/calendar'
import { CalendarConfigService } from '#server/services/calendar/calendar-config.service'

const calendarConfigService = new CalendarConfigService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'campaign.update')

  const parsed = await validateBody(event, calendarTemplateApplySchema, 'Invalid calendar template payload')

  const result = await calendarConfigService.applyTemplate(campaignId, parsed)
  return ok(result)
})

