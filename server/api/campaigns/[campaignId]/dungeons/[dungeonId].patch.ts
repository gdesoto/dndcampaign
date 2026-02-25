import { fail, ok } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { dungeonUpdateSchema } from '#shared/schemas/dungeon'
import { DungeonService } from '#server/services/dungeon/dungeon.service'

const dungeonService = new DungeonService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const dungeonId = event.context.params?.dungeonId
  if (!campaignId || !dungeonId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and dungeon id are required')
  }

  const parsed = await readValidatedBodySafe(event, dungeonUpdateSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid dungeon payload', parsed.fieldErrors)
  }

  const sessionUser = await requireUserSession(event)
  const result = await dungeonService.updateDungeon(campaignId, dungeonId, sessionUser.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
