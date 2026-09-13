import { ok } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { registerSchema } from '#shared/schemas/auth'
import { AuthService, toAuthUserDto } from '#server/services/auth.service'
import { enforceRateLimit } from '#server/utils/rate-limit'

const authService = new AuthService()

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, {
    key: 'auth:register',
    max: 10,
    windowMs: 10 * 60_000,
  })

  const parsed = await validateBody(event, registerSchema, 'Invalid register payload')

  const user = await authService.register(parsed)
  await authService.refreshSession(event, user)

  return ok({ user: toAuthUserDto(user) })
})
