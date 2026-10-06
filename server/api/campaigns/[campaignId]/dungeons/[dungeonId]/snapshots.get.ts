import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateQuery } from '#server/utils/validate'
import { dungeonSnapshotListQuerySchema } from '#shared/schemas/dungeon'
import { DungeonSnapshotService } from '#server/services/dungeon/dungeon-snapshot.service'

const dungeonSnapshotService = new DungeonSnapshotService()

export default defineEventHandler(async (event) => {
  const { campaignId, dungeonId } = routeParams(event, 'campaignId', 'dungeonId')
  const query = validateQuery(event, dungeonSnapshotListQuerySchema, 'Invalid snapshot query')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.read')
  const result = await dungeonSnapshotService.listSnapshots(campaignId, dungeonId, {
    includeMap: query.include === 'map',
    viewerSafe: actor.access.role === 'VIEWER',
  })
  return ok(result)
})
