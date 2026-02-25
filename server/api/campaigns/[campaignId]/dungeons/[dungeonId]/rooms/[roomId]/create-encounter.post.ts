import { fail, ok } from '#server/utils/http'
import { DungeonEditorService } from '#server/services/dungeon/dungeon-editor.service'

const dungeonEditorService = new DungeonEditorService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const dungeonId = event.context.params?.dungeonId
  const roomId = event.context.params?.roomId
  if (!campaignId || !dungeonId || !roomId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id, dungeon id, and room id are required')
  }

  const sessionUser = await requireUserSession(event)
  const result = await dungeonEditorService.createEncounterFromRoom(
    campaignId,
    dungeonId,
    roomId,
    sessionUser.user.id,
  )
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }
  return ok(result.data)
})
