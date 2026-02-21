import { fail, ok } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { CalendarConfigService } from '#server/services/calendar/calendar-config.service'

const calendarConfigService = new CalendarConfigService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.read')
  if (!authz.ok) {
    return authz.response
  }

  const result = await calendarConfigService.getConfig(campaignId, authz.session.user.id)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
