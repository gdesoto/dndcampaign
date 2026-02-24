import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { encounterTemplateUpdateSchema } from '#shared/schemas/encounter'
import { EncounterTemplateService } from '#server/services/encounter/encounter-template.service'

export default defineEventHandler(async (event) => {
  const templateId = event.context.params?.templateId
  if (!templateId) return fail(event, 400, '', 'Template id is required')

  const parsed = await readValidatedBodySafe(event, encounterTemplateUpdateSchema)
  if (!parsed.success) return fail(event, 400, '', 'Invalid template payload', parsed.fieldErrors)

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterTemplateService().updateTemplate(templateId, sessionUser.user.id, parsed.data)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})