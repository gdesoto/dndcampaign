import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateInput } from '#server/utils/validate'
import { readBody } from 'h3'
import { z } from 'zod'
import { encounterMapCreateSchema, encounterMapImportSchema } from '#shared/schemas/encounter-map'
import { EncounterMapService } from '#server/services/encounter-map/encounter-map.service'
import { EncounterMapExportService } from '#server/services/encounter-map/encounter-map-export.service'

const encounterMapService = new EncounterMapService()
const encounterMapExportService = new EncounterMapExportService()

const encounterMapCollectionActionSchema = z.object({
  action: z.literal('import'),
  source: encounterMapImportSchema.shape.source,
  nameOverride: encounterMapImportSchema.shape.nameOverride,
})

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const rawBody = (await readBody(event)) ?? {}

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.write')

  if (JSON.stringify(rawBody).length > 2_000_000) {
    throw apiError(413, 'PAYLOAD_TOO_LARGE', 'Import payload exceeds allowed size.')
  }

  const actionParsed = encounterMapCollectionActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    const result = await encounterMapExportService.importEncounterMap(campaignId, actor, {
      source: actionParsed.data.source,
      nameOverride: actionParsed.data.nameOverride,
    })
    return ok(result)
  }

  const createParsed = validateInput(encounterMapCreateSchema, rawBody, 'Invalid encounter map payload')

  const result = await encounterMapService.createEncounterMap(campaignId, actor, createParsed)

  return ok(result)
})
