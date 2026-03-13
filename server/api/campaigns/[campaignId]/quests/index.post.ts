import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { questCreateSchema } from '#shared/schemas/quest'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { QuestService } from '#server/services/quest.service'

const questService = new QuestService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'content.write')
  if (!authz.ok) {
    return authz.response
  }

  const parsed = await readValidatedBodySafe(event, questCreateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid quest payload', parsed.fieldErrors)
  }

  const result = await questService.createQuest(campaignId, parsed.data)
  if (!result.ok) {
    return fail(result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})

