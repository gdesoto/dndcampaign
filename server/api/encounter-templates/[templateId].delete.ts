import { ok, fail } from '#server/utils/http'
import { EncounterTemplateService } from '#server/services/encounter/encounter-template.service'

export default defineEventHandler(async (event) => {
  const templateId = event.context.params?.templateId
  if (!templateId) return fail(event, 400, '', 'Template id is required')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterTemplateService().deleteTemplate(templateId, sessionUser.user.id)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})