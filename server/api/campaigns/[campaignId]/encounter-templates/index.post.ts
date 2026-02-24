import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { encounterTemplateCreateSchema } from '#shared/schemas/encounter'
import { EncounterTemplateService } from '#server/services/encounter/encounter-template.service'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) return fail(event, 400, '', 'Campaign id is required')

  const parsed = await readValidatedBodySafe(event, encounterTemplateCreateSchema)
  if (!parsed.success) return fail(event, 400, '', 'Invalid template payload', parsed.fieldErrors)

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterTemplateService().createTemplate(campaignId, sessionUser.user.id, parsed.data)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})