import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { loginSchema } from '#shared/schemas/auth'
import { AuthService, toAuthUserDto } from '#server/services/auth.service'

const authService = new AuthService()

export default defineEventHandler(async (event) => {
  const parsed = await readValidatedBodySafe(event, loginSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid login payload', parsed.fieldErrors)
  }

  const authResult = await authService.authenticate(parsed.data.email, parsed.data.password)
  if (!authResult.ok) {
    return fail(event, authResult.statusCode, authResult.code, authResult.message, authResult.fields)
  }

  const user = authResult.data
  await authService.refreshSession(event, user)

  return ok({
    user: toAuthUserDto(user),
  })
})

