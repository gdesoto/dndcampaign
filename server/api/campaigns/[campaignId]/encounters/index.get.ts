import { validateQuery } from '#server/utils/validate'
import { fail, respond } from '#server/utils/http'
import { encounterListQuerySchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const sessionUser = await requireUserSession(event)
  const parsedQuery = validateQuery(event, encounterListQuerySchema, 'Invalid encounter query parameters')
  if (!parsedQuery.ok) return parsedQuery.response

  const result = await new EncounterService().listEncounters(campaignId, sessionUser.user.id, parsedQuery.data)
  return respond(event, result)
})