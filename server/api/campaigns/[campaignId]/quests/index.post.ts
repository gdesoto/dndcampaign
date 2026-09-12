import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { questCreateSchema } from '#shared/schemas/quest'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { QuestService } from '#server/services/quest.service'

const questService = new QuestService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'content.write')
  if (!authz.ok) {
    return authz.response
  }

  const parsed = await validateBody(event, questCreateSchema, 'Invalid quest payload')
  if (!parsed.ok) return parsed.response

  const result = await questService.createQuest(campaignId, parsed.data)
  return respond(event, result)
})

