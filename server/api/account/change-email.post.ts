import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { changeEmailSchema } from '#shared/schemas/auth'
import { AccountService } from '#server/services/account.service'

const accountService = new AccountService()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const parsed = await readValidatedBodySafe(event, changeEmailSchema)

  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid email payload', parsed.fieldErrors)
  }

  const result = await accountService.changeEmail(session.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  await accountService.syncSession(event, session.user.id)

  return ok({
    email: result.data.email,
  })
})
