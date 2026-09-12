import { validateQuery } from '#server/utils/validate'
import { fail, respond } from '#server/utils/http'
import { dungeonListQuerySchema } from '#shared/schemas/dungeon'
import { DungeonService } from '#server/services/dungeon/dungeon.service'

const dungeonService = new DungeonService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const sessionUser = await requireUserSession(event)
  const query = validateQuery(event, dungeonListQuerySchema, 'Invalid dungeon query parameters')
  if (!query.ok) return query.response

  const result = await dungeonService.listDungeons(campaignId, sessionUser.user.id, query.data)
  return respond(event, result)
})
