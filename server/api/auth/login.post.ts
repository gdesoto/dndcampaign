import { ok } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { loginSchema } from '#shared/schemas/auth'
import { AuthService, toAuthUserDto } from '#server/services/auth.service'
import { enforceRateLimit } from '#server/utils/rate-limit'

const authService = new AuthService()

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, {
    key: 'auth:login',
    max: 20,
    windowMs: 60_000,
  })

  const parsed = await validateBody(event, loginSchema, 'Invalid login payload')

  const authResult = await authService.authenticate(parsed.email, parsed.password)

  const user = authResult
  await authService.refreshSession(event, user)

  return ok({
    user: toAuthUserDto(user),
  })
})

