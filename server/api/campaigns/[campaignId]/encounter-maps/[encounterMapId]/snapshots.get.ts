import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateQuery } from '#server/utils/validate'
import { encounterMapSnapshotListQuerySchema } from '#shared/schemas/encounter-map'
import { EncounterMapSnapshotService } from '#server/services/encounter-map/encounter-map-snapshot.service'

const encounterMapSnapshotService = new EncounterMapSnapshotService()

export default defineEventHandler(async (event) => {
  const { campaignId, encounterMapId } = routeParams(event, 'campaignId', 'encounterMapId')
  const query = validateQuery(event, encounterMapSnapshotListQuerySchema, 'Invalid snapshot query')

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.read')
  const result = await encounterMapSnapshotService.listSnapshots(campaignId, encounterMapId, {
    includeMap: query.include === 'map',
    viewerSafe: actor.access.role === 'VIEWER',
  })
  return ok(result)
})
