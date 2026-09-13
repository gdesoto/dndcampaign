import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { questCreateSchema } from '#shared/schemas/quest'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { QuestService } from '#server/services/quest.service'

const questService = new QuestService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.write')

  const parsed = await validateBody(event, questCreateSchema, 'Invalid quest payload')

  const result = await questService.createQuest(campaignId, parsed)
  return ok(result)
})

