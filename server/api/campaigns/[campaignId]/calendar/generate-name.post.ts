import { ok, fail } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calendarNameGenerateSchema } from '#shared/schemas/calendar'
import { NameGeneratorService } from '#server/services/calendar/name-generator.service'

const nameGeneratorService = new NameGeneratorService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.update')
  if (!authz.ok) {
    return authz.response
  }

  const parsed = await validateBody(event, calendarNameGenerateSchema, 'Invalid name generation payload')
  if (!parsed.ok) return parsed.response

  const names = nameGeneratorService.generateNames(parsed.data.kind, parsed.data.count, parsed.data.seed)
  return ok({
    kind: parsed.data.kind,
    names,
  })
})
