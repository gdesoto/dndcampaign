import { fail, respond } from '#server/utils/http'
import { EncounterTemplateService } from '#server/services/encounter/encounter-template.service'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterTemplateService().listTemplates(campaignId, sessionUser.user.id)
  return respond(event, result)
})
