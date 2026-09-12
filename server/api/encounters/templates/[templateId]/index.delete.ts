import { fail, respond } from '#server/utils/http'
import { EncounterTemplateService } from '#server/services/encounter/encounter-template.service'

export default defineEventHandler(async (event) => {
  const templateId = event.context.params?.templateId
  if (!templateId) return fail(event, 400, 'VALIDATION_ERROR', 'Template id is required')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterTemplateService().deleteTemplate(templateId, sessionUser.user.id)
  return respond(event, result)
})
