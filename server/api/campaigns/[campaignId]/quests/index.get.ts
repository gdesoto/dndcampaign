import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { QuestService } from '#server/services/quest.service'

const questService = new QuestService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.read')

  const quests = await questService.listCampaignQuests(campaignId)

  return ok(quests)
})

