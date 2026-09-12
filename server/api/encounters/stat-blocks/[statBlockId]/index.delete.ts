import { fail, respond } from '#server/utils/http'
import { EncounterStatBlockService } from '#server/services/encounter/encounter-stat-block.service'

export default defineEventHandler(async (event) => {
  const statBlockId = event.context.params?.statBlockId
  if (!statBlockId) return fail(event, 400, 'VALIDATION_ERROR', 'Stat block id is required')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterStatBlockService().deleteStatBlock(statBlockId, sessionUser.user.id)
  return respond(event, result)
})
