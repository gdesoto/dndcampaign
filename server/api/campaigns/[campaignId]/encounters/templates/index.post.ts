import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterTemplateCreateSchema } from '#shared/schemas/encounter'
import { EncounterTemplateService } from '#server/services/encounter/encounter-template.service'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')

  const parsed = await validateBody(event, encounterTemplateCreateSchema, 'Invalid template payload')
  if (!parsed.ok) return parsed.response

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterTemplateService().createTemplate(campaignId, sessionUser.user.id, parsed.data)
  return respond(event, result)
})
