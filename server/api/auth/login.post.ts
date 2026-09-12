import { ok, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { loginSchema } from '#shared/schemas/auth'
import { AuthService, toAuthUserDto } from '#server/services/auth.service'
import { enforceRateLimit } from '#server/utils/rate-limit'

const authService = new AuthService()

export default defineEventHandler(async (event) => {
  const rateLimitResponse = enforceRateLimit(event, {
    key: 'auth:login',
    max: 20,
    windowMs: 60_000,
  })
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  const parsed = await validateBody(event, loginSchema, 'Invalid login payload')
  if (!parsed.ok) return parsed.response

  const authResult = await authService.authenticate(parsed.data.email, parsed.data.password)
  if (!authResult.ok) {
    return respond(event, authResult)
  }

  const user = authResult.data
  await authService.refreshSession(event, user)

  return ok({
    user: toAuthUserDto(user),
  })
})

