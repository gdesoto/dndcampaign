import { readBody } from 'h3'
import { z } from 'zod'
import { fail, respond } from '#server/utils/http'
import { validateInput } from '#server/utils/validate'
import { dungeonRoomUpdateSchema } from '#shared/schemas/dungeon'
import { DungeonEditorService } from '#server/services/dungeon/dungeon-editor.service'

const dungeonEditorService = new DungeonEditorService()
const dungeonRoomActionSchema = z.object({
  action: z.literal('create-encounter'),
})

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const dungeonId = event.context.params?.dungeonId
  const roomId = event.context.params?.roomId
  if (!campaignId || !dungeonId || !roomId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id, dungeon id, and room id are required')
  }

  const rawBody = (await readBody(event)) ?? {}

  const sessionUser = await requireUserSession(event)

  const actionParsed = dungeonRoomActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    const result = await dungeonEditorService.createEncounterFromRoom(
      campaignId,
      dungeonId,
      roomId,
      sessionUser.user.id
    )
    return respond(event, result)
  }

  const parsed = validateInput(event, dungeonRoomUpdateSchema, rawBody, 'Invalid room update payload')
  if (!parsed.ok) return parsed.response

  const result = await dungeonEditorService.updateRoom(
    campaignId,
    dungeonId,
    roomId,
    sessionUser.user.id,
    parsed.data
  )
  return respond(event, result)
})
