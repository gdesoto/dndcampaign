import { ok } from '#server/utils/http'
import { apiKeyService } from '#server/services/api-key.service'
import { requireCookieSession } from '#server/utils/api-auth'

export default defineEventHandler(async (event) => {
  const session = await requireCookieSession(event)
  return ok({ keys: await apiKeyService.list(session.user.id) })
})
