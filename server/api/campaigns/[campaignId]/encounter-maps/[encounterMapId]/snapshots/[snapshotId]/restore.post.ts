import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { EncounterMapSnapshotService } from '#server/services/encounter-map/encounter-map-snapshot.service'

const encounterMapSnapshotService = new EncounterMapSnapshotService()

export default defineEventHandler(async (event) => {
  const { campaignId, encounterMapId, snapshotId } = routeParams(event, 'campaignId', 'encounterMapId', 'snapshotId')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await encounterMapSnapshotService.restoreSnapshot(campaignId, encounterMapId, snapshotId, actor)
  return ok(result)
})
