import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterStatBlockCreateSchema } from '#shared/schemas/encounter'
import { EncounterStatBlockService } from '#server/services/encounter/encounter-stat-block.service'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')

  const parsed = await validateBody(event, encounterStatBlockCreateSchema, 'Invalid stat block payload')
  if (!parsed.ok) return parsed.response

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterStatBlockService().createStatBlock(campaignId, sessionUser.user.id, parsed.data)
  return respond(event, result)
})
