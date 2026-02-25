import { fail, ok } from '#server/utils/http'
import { DungeonService } from '#server/services/dungeon/dungeon.service'

const dungeonService = new DungeonService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const dungeonId = event.context.params?.dungeonId
  if (!campaignId || !dungeonId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and dungeon id are required')
  }

  const sessionUser = await requireUserSession(event)
  const result = await dungeonService.setPublishStatus(campaignId, dungeonId, sessionUser.user.id, 'READY')
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }
  return ok(result.data)
})
