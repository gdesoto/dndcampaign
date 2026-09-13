import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterStatBlockUpdateSchema } from '#shared/schemas/encounter'
import { EncounterStatBlockService } from '#server/services/encounter/encounter-stat-block.service'

export default defineEventHandler(async (event) => {
  const { statBlockId } = routeParams(event, 'statBlockId')

  const parsed = await validateBody(event, encounterStatBlockUpdateSchema, 'Invalid stat block payload')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterStatBlockService().updateStatBlock(statBlockId, sessionUser.user.id, parsed)
  return ok(result)
})
