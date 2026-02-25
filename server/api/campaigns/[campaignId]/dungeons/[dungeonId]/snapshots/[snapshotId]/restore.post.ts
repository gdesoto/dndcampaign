import { fail, ok } from '#server/utils/http'
import { DungeonSnapshotService } from '#server/services/dungeon/dungeon-snapshot.service'

const dungeonSnapshotService = new DungeonSnapshotService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const dungeonId = event.context.params?.dungeonId
  const snapshotId = event.context.params?.snapshotId
  if (!campaignId || !dungeonId || !snapshotId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id, dungeon id, and snapshot id are required')
  }

  const sessionUser = await requireUserSession(event)
  const result = await dungeonSnapshotService.restoreSnapshot(campaignId, dungeonId, snapshotId, sessionUser.user.id)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }
  return ok(result.data)
})
