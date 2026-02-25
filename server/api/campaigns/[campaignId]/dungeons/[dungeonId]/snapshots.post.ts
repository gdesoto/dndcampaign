import { fail, ok } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { dungeonSnapshotCreateSchema } from '#shared/schemas/dungeon'
import { DungeonSnapshotService } from '#server/services/dungeon/dungeon-snapshot.service'

const dungeonSnapshotService = new DungeonSnapshotService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const dungeonId = event.context.params?.dungeonId
  if (!campaignId || !dungeonId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and dungeon id are required')
  }

  const parsed = await readValidatedBodySafe(event, dungeonSnapshotCreateSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid snapshot payload', parsed.fieldErrors)
  }

  const sessionUser = await requireUserSession(event)
  const result = await dungeonSnapshotService.createSnapshot(campaignId, dungeonId, sessionUser.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }
  return ok(result.data)
})
