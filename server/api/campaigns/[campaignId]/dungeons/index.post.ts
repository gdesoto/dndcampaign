import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateInput } from '#server/utils/validate'
import { readBody } from 'h3'
import { z } from 'zod'
import { dungeonCreateSchema, dungeonImportSchema } from '#shared/schemas/dungeon'
import { DungeonService } from '#server/services/dungeon/dungeon.service'
import { DungeonExportService } from '#server/services/dungeon/dungeon-export.service'

const dungeonService = new DungeonService()
const dungeonExportService = new DungeonExportService()

const dungeonCollectionActionSchema = z.object({
  action: z.literal('import'),
  source: dungeonImportSchema.shape.source,
  nameOverride: dungeonImportSchema.shape.nameOverride,
})

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const rawBody = (await readBody(event)) ?? {}

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.write')

  if (JSON.stringify(rawBody).length > 2_000_000) {
    throw apiError(413, 'PAYLOAD_TOO_LARGE', 'Import payload exceeds allowed size.')
  }

  const actionParsed = dungeonCollectionActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    const result = await dungeonExportService.importDungeon(campaignId, actor, {
      source: actionParsed.data.source,
      nameOverride: actionParsed.data.nameOverride,
    })
    return ok(result)
  }

  const createParsed = validateInput(dungeonCreateSchema, rawBody, 'Invalid dungeon payload')

  const result = await dungeonService.createDungeon(campaignId, actor, createParsed)

  return ok(result)
})
