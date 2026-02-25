import { fail, ok } from '#server/utils/http'
import { DungeonEditorService } from '#server/services/dungeon/dungeon-editor.service'

const dungeonEditorService = new DungeonEditorService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const dungeonId = event.context.params?.dungeonId
  const linkId = event.context.params?.linkId
  if (!campaignId || !dungeonId || !linkId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id, dungeon id, and link id are required')
  }

  const sessionUser = await requireUserSession(event)
  const result = await dungeonEditorService.deleteLink(campaignId, dungeonId, linkId, sessionUser.user.id)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
