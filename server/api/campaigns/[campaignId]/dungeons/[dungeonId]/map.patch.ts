import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { dungeonMapPatchSchema } from '#shared/schemas/dungeon'
import { DungeonEditorService } from '#server/services/dungeon/dungeon-editor.service'

const dungeonEditorService = new DungeonEditorService()

export default defineEventHandler(async (event) => {
  const { campaignId, dungeonId } = routeParams(event, 'campaignId', 'dungeonId')

  const parsed = await validateBody(event, dungeonMapPatchSchema, 'Invalid map patch payload')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await dungeonEditorService.patchMap(campaignId, dungeonId, actor, parsed)
  return ok(result)
})
