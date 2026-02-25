import { fail, ok } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { dungeonExportSchema } from '#shared/schemas/dungeon'
import { DungeonExportService } from '#server/services/dungeon/dungeon-export.service'

const dungeonExportService = new DungeonExportService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const dungeonId = event.context.params?.dungeonId
  if (!campaignId || !dungeonId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and dungeon id are required')
  }

  const parsed = await readValidatedBodySafe(event, dungeonExportSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid export payload', parsed.fieldErrors)
  }

  const sessionUser = await requireUserSession(event)
  const result = await dungeonExportService.exportDungeon(campaignId, dungeonId, sessionUser.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
