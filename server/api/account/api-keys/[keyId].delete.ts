import { ok, routeParams } from '#server/utils/http'
import { apiKeyService } from '#server/services/api-key.service'
import { requireCookieSession } from '#server/utils/api-auth'

export default defineEventHandler(async (event) => {
  const session = await requireCookieSession(event)
  const { keyId } = routeParams(event, 'keyId')
  return ok(await apiKeyService.revoke(session.user.id, keyId))
})
