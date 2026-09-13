import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { DungeonSnapshotService } from '#server/services/dungeon/dungeon-snapshot.service'

const dungeonSnapshotService = new DungeonSnapshotService()

export default defineEventHandler(async (event) => {
  const { campaignId, dungeonId, snapshotId } = routeParams(event, 'campaignId', 'dungeonId', 'snapshotId')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await dungeonSnapshotService.restoreSnapshot(campaignId, dungeonId, snapshotId, actor)
  return ok(result)
})
