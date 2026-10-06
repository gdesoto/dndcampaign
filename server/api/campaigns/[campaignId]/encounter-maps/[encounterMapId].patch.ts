import { readBody } from 'h3'
import { z } from 'zod'
import { ok, routeParams } from '#server/utils/http'
import { assertCampaignPermission, requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateInput } from '#server/utils/validate'
import {
  encounterMapExportSchema,
  encounterMapGenerateSchema,
  encounterMapRegenerateSchema,
  encounterMapUpdateSchema,
} from '#shared/schemas/encounter-map'
import { EncounterMapService } from '#server/services/encounter-map/encounter-map.service'
import { EncounterMapExportService } from '#server/services/encounter-map/encounter-map-export.service'

const encounterMapService = new EncounterMapService()
const encounterMapExportService = new EncounterMapExportService()

const encounterMapPatchActionSchema = z.discriminatedUnion('action', [
  encounterMapGenerateSchema.extend({ action: z.literal('generate') }),
  encounterMapRegenerateSchema.safeExtend({ action: z.literal('regenerate') }),
  z.object({ action: z.literal('publish') }),
  z.object({ action: z.literal('unpublish') }),
  encounterMapExportSchema.extend({ action: z.literal('export') }),
])

export default defineEventHandler(async (event) => {
  const { campaignId, encounterMapId } = routeParams(event, 'campaignId', 'encounterMapId')

  const rawBody = (await readBody(event)) ?? {}

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.read')

  if (typeof rawBody === 'object' && rawBody !== null && 'action' in rawBody) {
    const action = validateInput(encounterMapPatchActionSchema, rawBody, 'Invalid encounter map action')
    switch (action.action) {
      case 'generate': {
        assertCampaignPermission(actor.access, 'content.write')
        const result = await encounterMapService.generateEncounterMap(
          campaignId,
          encounterMapId,
          actor,
          action
        )
        return ok(result)
      }
      case 'regenerate': {
        assertCampaignPermission(actor.access, 'content.write')
        const result = await encounterMapService.regenerateEncounterMap(
          campaignId,
          encounterMapId,
          actor,
          action
        )
        return ok(result)
      }
      case 'publish':
      case 'unpublish': {
        assertCampaignPermission(actor.access, 'campaign.public.manage')
        const result = await encounterMapService.setPublishStatus(
          campaignId,
          encounterMapId,
          actor,
          action.action === 'publish' ? 'READY' : 'DRAFT'
        )
        return ok(result)
      }
      case 'export': {
        const result = await encounterMapExportService.exportEncounterMap(
          campaignId,
          encounterMapId,
          actor,
          action
        )
        return ok(result)
      }
      default:
        break
    }
  }

  assertCampaignPermission(actor.access, 'content.write')
  const parsed = validateInput(encounterMapUpdateSchema, rawBody, 'Invalid encounter map payload')

  const result = await encounterMapService.updateEncounterMap(campaignId, encounterMapId, actor, parsed)
  return ok(result)
})
