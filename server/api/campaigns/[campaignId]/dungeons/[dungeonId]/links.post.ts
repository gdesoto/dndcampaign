import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { dungeonLinkCreateSchema } from '#shared/schemas/dungeon'
import { DungeonEditorService } from '#server/services/dungeon/dungeon-editor.service'

const dungeonEditorService = new DungeonEditorService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const dungeonId = event.context.params?.dungeonId
  if (!campaignId || !dungeonId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and dungeon id are required')
  }

  const parsed = await validateBody(event, dungeonLinkCreateSchema, 'Invalid dungeon link payload')
  if (!parsed.ok) return parsed.response

  const sessionUser = await requireUserSession(event)
  const result = await dungeonEditorService.createLink(campaignId, dungeonId, sessionUser.user.id, parsed.data)
  return respond(event, result)
})
