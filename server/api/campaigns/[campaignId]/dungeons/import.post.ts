import { readBody } from 'h3'
import { fail, ok } from '#server/utils/http'
import { dungeonImportSchema } from '#shared/schemas/dungeon'
import { DungeonExportService } from '#server/services/dungeon/dungeon-export.service'

const dungeonExportService = new DungeonExportService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const rawBody = await readBody(event)
  if (JSON.stringify(rawBody).length > 2_000_000) {
    return fail(event, 413, 'PAYLOAD_TOO_LARGE', 'Import payload exceeds allowed size.')
  }

  const parsed = dungeonImportSchema.safeParse(rawBody)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'body'
      fieldErrors[key] = issue.message
    }
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid import payload', fieldErrors)
  }

  const sessionUser = await requireUserSession(event)
  const result = await dungeonExportService.importDungeon(campaignId, sessionUser.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }
  return ok(result.data)
})
