import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { encounterMapSnapshotCreateSchema } from '#shared/schemas/encounter-map'
import { EncounterMapSnapshotService } from '#server/services/encounter-map/encounter-map-snapshot.service'

const encounterMapSnapshotService = new EncounterMapSnapshotService()

export default defineEventHandler(async (event) => {
  const { campaignId, encounterMapId } = routeParams(event, 'campaignId', 'encounterMapId')

  const parsed = await validateBody(event, encounterMapSnapshotCreateSchema, 'Invalid snapshot payload')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.write')
  const result = await encounterMapSnapshotService.createSnapshot(campaignId, encounterMapId, actor, parsed)
  return ok(result)
})
