import { readBody } from 'h3'
import { z } from 'zod'
import { fail, ok } from '#server/utils/http'
import { dungeonRoomUpdateSchema } from '#shared/schemas/dungeon'
import { DungeonEditorService } from '#server/services/dungeon/dungeon-editor.service'

const dungeonEditorService = new DungeonEditorService()
const dungeonRoomActionSchema = z.object({
  action: z.literal('create-encounter'),
})

const toFieldErrors = (issues: z.ZodIssue[]) => {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.join('.') || 'body'
    fieldErrors[key] = issue.message
  }
  return fieldErrors
}

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
    if (!result.ok) {
      return fail(event, result.statusCode, result.code, result.message, result.fields)
    }
    return ok(result.data)
  }

  const parsed = dungeonRoomUpdateSchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail(
      event,
      400,
      'VALIDATION_ERROR',
      'Invalid room update payload',
      toFieldErrors(parsed.error.issues)
    )
  }

  const result = await dungeonEditorService.updateRoom(
    campaignId,
    dungeonId,
    roomId,
    sessionUser.user.id,
    parsed.data
  )
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
