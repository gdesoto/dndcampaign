import { ok, fail } from '#server/utils/http'
import { EncounterStatBlockService } from '#server/services/encounter/encounter-stat-block.service'

export default defineEventHandler(async (event) => {
  const statBlockId = event.context.params?.statBlockId
  if (!statBlockId) return fail(event, 400, '', 'Stat block id is required')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterStatBlockService().deleteStatBlock(statBlockId, sessionUser.user.id)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})