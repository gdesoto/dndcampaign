import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { calendarNameGenerateSchema } from '#shared/schemas/calendar'
import { NameGeneratorService } from '#server/services/calendar/name-generator.service'

const nameGeneratorService = new NameGeneratorService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'campaign.update')

  const parsed = await validateBody(event, calendarNameGenerateSchema, 'Invalid name generation payload')

  const names = nameGeneratorService.generateNames(parsed.kind, parsed.count, parsed.seed)
  return ok({
    kind: parsed.kind,
    names,
  })
})
