import { ok, fail } from '#server/utils/http'
import { EncounterStatBlockService } from '#server/services/encounter/encounter-stat-block.service'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) return fail(event, 400, '', 'Campaign id is required')

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterStatBlockService().listStatBlocks(campaignId, sessionUser.user.id)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})