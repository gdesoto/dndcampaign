import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { dungeonLinkCreateSchema } from '#shared/schemas/dungeon'
import { DungeonEditorService } from '#server/services/dungeon/dungeon-editor.service'

const dungeonEditorService = new DungeonEditorService()

export default defineEventHandler(async (event) => {
  const { campaignId, dungeonId } = routeParams(event, 'campaignId', 'dungeonId')

  const parsed = await validateBody(event, dungeonLinkCreateSchema, 'Invalid dungeon link payload')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await dungeonEditorService.createLink(campaignId, dungeonId, actor, parsed)
  return ok(result)
})
