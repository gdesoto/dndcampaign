import { fail, respond } from '#server/utils/http'
import { EncounterStatBlockService } from '#server/services/encounter/encounter-stat-block.service'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterStatBlockService().listStatBlocks(campaignId, sessionUser.user.id)
  return respond(event, result)
})
