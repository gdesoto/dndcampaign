import { getQuery } from 'h3'
import { fail, ok } from '#server/utils/http'
import { dungeonListQuerySchema } from '#shared/schemas/dungeon'
import { DungeonService } from '#server/services/dungeon/dungeon.service'

const dungeonService = new DungeonService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const sessionUser = await requireUserSession(event)
  const query = dungeonListQuerySchema.safeParse(getQuery(event))
  if (!query.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid dungeon query parameters')
  }

  const result = await dungeonService.listDungeons(campaignId, sessionUser.user.id, query.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
