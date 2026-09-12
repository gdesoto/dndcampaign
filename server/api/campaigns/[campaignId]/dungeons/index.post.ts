import { fail, respond } from '#server/utils/http'
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
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const rawBody = (await readBody(event)) ?? {}

  const sessionUser = await requireUserSession(event)

  if (JSON.stringify(rawBody).length > 2_000_000) {
    return fail(event, 413, 'PAYLOAD_TOO_LARGE', 'Import payload exceeds allowed size.')
  }

  const actionParsed = dungeonCollectionActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    const result = await dungeonExportService.importDungeon(campaignId, sessionUser.user.id, {
      source: actionParsed.data.source,
      nameOverride: actionParsed.data.nameOverride,
    })
    return respond(event, result)
  }

  const createParsed = validateInput(event, dungeonCreateSchema, rawBody, 'Invalid dungeon payload')
  if (!createParsed.ok) return createParsed.response

  const result = await dungeonService.createDungeon(campaignId, sessionUser.user.id, createParsed.data)

  return respond(event, result)
})
