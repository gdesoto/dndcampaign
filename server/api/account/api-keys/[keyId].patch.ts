import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { apiKeyUpdateSchema } from '#shared/schemas/api-key'
import { apiKeyService } from '#server/services/api-key.service'
import { requireCookieSession } from '#server/utils/api-auth'

export default defineEventHandler(async (event) => {
  const session = await requireCookieSession(event)
  const { keyId } = routeParams(event, 'keyId')
  return ok(await apiKeyService.update(session.user.id, keyId, await validateBody(event, apiKeyUpdateSchema)))
})
