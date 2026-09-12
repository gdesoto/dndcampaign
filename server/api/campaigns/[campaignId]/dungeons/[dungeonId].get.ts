import { fail, respond } from '#server/utils/http'
import { DungeonService } from '#server/services/dungeon/dungeon.service'

const dungeonService = new DungeonService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const dungeonId = event.context.params?.dungeonId
  if (!campaignId || !dungeonId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and dungeon id are required')
  }

  const sessionUser = await requireUserSession(event)
  const result = await dungeonService.getDungeon(campaignId, dungeonId, sessionUser.user.id)
  return respond(event, result)
})
