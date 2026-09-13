import { ok, routeParams } from '#server/utils/http'
import { EncounterTemplateService } from '#server/services/encounter/encounter-template.service'

export default defineEventHandler(async (event) => {
  const { templateId } = routeParams(event, 'templateId')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterTemplateService().deleteTemplate(templateId, sessionUser.user.id)
  return ok(result)
})
