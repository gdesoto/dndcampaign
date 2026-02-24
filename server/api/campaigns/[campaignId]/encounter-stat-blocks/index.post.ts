import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { encounterStatBlockCreateSchema } from '#shared/schemas/encounter'
import { EncounterStatBlockService } from '#server/services/encounter/encounter-stat-block.service'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) return fail(event, 400, '', 'Campaign id is required')

  const parsed = await readValidatedBodySafe(event, encounterStatBlockCreateSchema)
  if (!parsed.success) return fail(event, 400, '', 'Invalid stat block payload', parsed.fieldErrors)

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterStatBlockService().createStatBlock(campaignId, sessionUser.user.id, parsed.data)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})