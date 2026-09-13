import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { dungeonSnapshotCreateSchema } from '#shared/schemas/dungeon'
import { DungeonSnapshotService } from '#server/services/dungeon/dungeon-snapshot.service'

const dungeonSnapshotService = new DungeonSnapshotService()

export default defineEventHandler(async (event) => {
  const { campaignId, dungeonId } = routeParams(event, 'campaignId', 'dungeonId')

  const parsed = await validateBody(event, dungeonSnapshotCreateSchema, 'Invalid snapshot payload')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await dungeonSnapshotService.createSnapshot(campaignId, dungeonId, actor, parsed)
  return ok(result)
})
