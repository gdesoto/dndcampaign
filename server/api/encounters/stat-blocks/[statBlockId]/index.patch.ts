import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterStatBlockUpdateSchema } from '#shared/schemas/encounter'
import { EncounterStatBlockService } from '#server/services/encounter/encounter-stat-block.service'

export default defineEventHandler(async (event) => {
  const statBlockId = event.context.params?.statBlockId
  if (!statBlockId) return fail(event, 400, 'VALIDATION_ERROR', 'Stat block id is required')

  const parsed = await validateBody(event, encounterStatBlockUpdateSchema, 'Invalid stat block payload')
  if (!parsed.ok) return parsed.response

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterStatBlockService().updateStatBlock(statBlockId, sessionUser.user.id, parsed.data)
  return respond(event, result)
})
