import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { DungeonEditorService } from '#server/services/dungeon/dungeon-editor.service'

const dungeonEditorService = new DungeonEditorService()

export default defineEventHandler(async (event) => {
  const { campaignId, dungeonId } = routeParams(event, 'campaignId', 'dungeonId')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.read')
  const result = await dungeonEditorService.listRooms(campaignId, dungeonId, actor)
  return ok(result)
})
