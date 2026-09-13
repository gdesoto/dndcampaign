import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterTemplateInstantiateSchema } from '#shared/schemas/encounter'
import { EncounterTemplateService } from '#server/services/encounter/encounter-template.service'

export default defineEventHandler(async (event) => {
  const { templateId } = routeParams(event, 'templateId')

  const parsed = await validateBody(event, encounterTemplateInstantiateSchema, 'Invalid instantiate payload')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterTemplateService().instantiateTemplate(templateId, sessionUser.user.id, parsed)
  return ok(result)
})
