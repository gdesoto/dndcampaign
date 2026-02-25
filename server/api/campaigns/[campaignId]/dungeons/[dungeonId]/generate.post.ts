import { readBody } from 'h3'
import { fail, ok } from '#server/utils/http'
import { dungeonGenerateSchema } from '#shared/schemas/dungeon'
import { DungeonService } from '#server/services/dungeon/dungeon.service'

const dungeonService = new DungeonService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const dungeonId = event.context.params?.dungeonId
  if (!campaignId || !dungeonId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and dungeon id are required')
  }

  const body = (await readBody(event)) ?? {}
  const parsed = dungeonGenerateSchema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'body'
      fieldErrors[key] = issue.message
    }
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid generate payload', fieldErrors)
  }

  const sessionUser = await requireUserSession(event)
  const result = await dungeonService.generateDungeon(campaignId, dungeonId, sessionUser.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
