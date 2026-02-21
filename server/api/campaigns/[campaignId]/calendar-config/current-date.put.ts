import { fail, ok } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calendarCurrentDateUpdateSchema } from '#shared/schemas/calendar'
import { CalendarConfigService } from '#server/services/calendar/calendar-config.service'

const calendarConfigService = new CalendarConfigService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.update')
  if (!authz.ok) {
    return authz.response
  }

  const parsed = await readValidatedBodySafe(event, calendarCurrentDateUpdateSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid current date payload', parsed.fieldErrors)
  }

  const result = await calendarConfigService.updateCurrentDate(campaignId, authz.session.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
