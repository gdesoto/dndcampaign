import { getQuery } from 'h3'
import { ok, fail } from '#server/utils/http'
import { encounterListQuerySchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, '', 'Campaign id is required')
  }

  const sessionUser = await requireUserSession(event)
  const parsedQuery = encounterListQuerySchema.safeParse(getQuery(event))
  if (!parsedQuery.success) {
    return fail(event, 400, '', 'Invalid encounter query parameters')
  }

  const result = await new EncounterService().listEncounters(campaignId, sessionUser.user.id, parsedQuery.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})