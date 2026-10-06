import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { dungeonSnapshotUpdateSchema } from '#shared/schemas/dungeon'
import { DungeonSnapshotService } from '#server/services/dungeon/dungeon-snapshot.service'

const dungeonSnapshotService = new DungeonSnapshotService()

export default defineEventHandler(async (event) => {
  const { campaignId, dungeonId, snapshotId } = routeParams(event, 'campaignId', 'dungeonId', 'snapshotId')

  const parsed = await validateBody(event, dungeonSnapshotUpdateSchema, 'Invalid snapshot payload')

  await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await dungeonSnapshotService.updateSnapshot(campaignId, dungeonId, snapshotId, parsed)
  return ok(result)
})
