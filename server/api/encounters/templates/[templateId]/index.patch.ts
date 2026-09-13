import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterTemplateUpdateSchema } from '#shared/schemas/encounter'
import { EncounterTemplateService } from '#server/services/encounter/encounter-template.service'

export default defineEventHandler(async (event) => {
  const { templateId } = routeParams(event, 'templateId')

  const parsed = await validateBody(event, encounterTemplateUpdateSchema, 'Invalid template payload')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterTemplateService().updateTemplate(templateId, sessionUser.user.id, parsed)
  return ok(result)
})
