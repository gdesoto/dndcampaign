import { fail, ok } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
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

  const parsed = await readValidatedBodySafe(event, calendarNameGenerateSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid name generation payload', parsed.fieldErrors)
  }

  const names = nameGeneratorService.generateNames(parsed.data.kind, parsed.data.count, parsed.data.seed)
  return ok({
    kind: parsed.data.kind,
    names,
  })
})
