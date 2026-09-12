import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterTemplateInstantiateSchema } from '#shared/schemas/encounter'
import { EncounterTemplateService } from '#server/services/encounter/encounter-template.service'

export default defineEventHandler(async (event) => {
  const templateId = event.context.params?.templateId
  if (!templateId) return fail(event, 400, 'VALIDATION_ERROR', 'Template id is required')

  const parsed = await validateBody(event, encounterTemplateInstantiateSchema, 'Invalid instantiate payload')
  if (!parsed.ok) return parsed.response

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterTemplateService().instantiateTemplate(templateId, sessionUser.user.id, parsed.data)
  return respond(event, result)
})
