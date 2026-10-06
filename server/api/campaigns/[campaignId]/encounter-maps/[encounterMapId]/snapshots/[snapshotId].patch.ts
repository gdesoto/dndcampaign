import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { encounterMapSnapshotUpdateSchema } from '#shared/schemas/encounter-map'
import { EncounterMapSnapshotService } from '#server/services/encounter-map/encounter-map-snapshot.service'

const encounterMapSnapshotService = new EncounterMapSnapshotService()

export default defineEventHandler(async (event) => {
  const { campaignId, encounterMapId, snapshotId } = routeParams(event, 'campaignId', 'encounterMapId', 'snapshotId')

  const parsed = await validateBody(event, encounterMapSnapshotUpdateSchema, 'Invalid snapshot payload')

  await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await encounterMapSnapshotService.updateSnapshot(campaignId, encounterMapId, snapshotId, parsed)
  return ok(result)
})
