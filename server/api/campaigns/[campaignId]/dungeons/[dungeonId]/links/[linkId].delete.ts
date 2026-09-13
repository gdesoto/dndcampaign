import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { DungeonEditorService } from '#server/services/dungeon/dungeon-editor.service'

const dungeonEditorService = new DungeonEditorService()

export default defineEventHandler(async (event) => {
  const { campaignId, dungeonId, linkId } = routeParams(event, 'campaignId', 'dungeonId', 'linkId')

  await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await dungeonEditorService.deleteLink(campaignId, dungeonId, linkId)
  return ok(result)
})
