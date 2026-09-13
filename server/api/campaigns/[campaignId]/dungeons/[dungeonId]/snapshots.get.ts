import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { DungeonSnapshotService } from '#server/services/dungeon/dungeon-snapshot.service'

const dungeonSnapshotService = new DungeonSnapshotService()

export default defineEventHandler(async (event) => {
  const { campaignId, dungeonId } = routeParams(event, 'campaignId', 'dungeonId')

  await requireCampaignPermission(event, campaignId, 'content.read')
  const result = await dungeonSnapshotService.listSnapshots(campaignId, dungeonId)
  return ok(result)
})
