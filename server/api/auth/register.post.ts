import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { registerSchema } from '#shared/schemas/auth'
import { AuthService, toAuthUserDto } from '#server/services/auth.service'

const authService = new AuthService()

export default defineEventHandler(async (event) => {
  const parsed = await readValidatedBodySafe(event, registerSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid register payload', parsed.fieldErrors)
  }

  const registerResult = await authService.register(parsed.data)
  if (!registerResult.ok) {
    return fail(
      event,
      registerResult.statusCode,
      registerResult.code,
      registerResult.message,
      registerResult.fields
    )
  }

  await authService.refreshSession(event, registerResult.data)

  return ok({
    user: toAuthUserDto(registerResult.data),
  })
})
