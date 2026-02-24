import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { encounterStatBlockUpdateSchema } from '#shared/schemas/encounter'
import { EncounterStatBlockService } from '#server/services/encounter/encounter-stat-block.service'

export default defineEventHandler(async (event) => {
  const statBlockId = event.context.params?.statBlockId
  if (!statBlockId) return fail(event, 400, '', 'Stat block id is required')

  const parsed = await readValidatedBodySafe(event, encounterStatBlockUpdateSchema)
  if (!parsed.success) return fail(event, 400, '', 'Invalid stat block payload', parsed.fieldErrors)

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterStatBlockService().updateStatBlock(statBlockId, sessionUser.user.id, parsed.data)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})