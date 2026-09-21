import { ok } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { apiKeyCreateSchema } from '#shared/schemas/api-key'
import { apiKeyService } from '#server/services/api-key.service'
import { requireCookieSession } from '#server/utils/api-auth'

export default defineEventHandler(async (event) => {
  const session = await requireCookieSession(event)
  const input = await validateBody(event, apiKeyCreateSchema)
  return ok(await apiKeyService.create(session.user.id, input))
})
