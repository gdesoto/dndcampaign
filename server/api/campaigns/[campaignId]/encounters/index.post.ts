import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { encounterCreateSchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, '', 'Campaign id is required')
  }

  const parsed = await readValidatedBodySafe(event, encounterCreateSchema)
  if (!parsed.success) {
    return fail(event, 400, '', 'Invalid encounter payload', parsed.fieldErrors)
  }

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterService().createEncounter(campaignId, sessionUser.user.id, parsed.data)

  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})