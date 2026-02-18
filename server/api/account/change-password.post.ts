import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { changePasswordSchema } from '#shared/schemas/auth'
import { AccountService } from '#server/services/account.service'

const accountService = new AccountService()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const parsed = await readValidatedBodySafe(event, changePasswordSchema)

  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid password payload', parsed.fieldErrors)
  }

  const result = await accountService.changePassword(session.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok({ success: true })
})
