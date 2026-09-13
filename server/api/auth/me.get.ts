import { ok, apiError } from '#server/utils/http'
import { AccountService } from '#server/services/account.service'
import { toAuthUserDto } from '#server/services/auth.service'

const accountService = new AccountService()

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw apiError(401, 'UNAUTHORIZED', 'Not authenticated')
  }

  const user = await accountService.getActiveProfile(session.user.id)

  if (!user) {
    await clearUserSession(event)
    throw apiError(401, 'UNAUTHORIZED', 'Not authenticated')
  }

  return ok({ user: toAuthUserDto(user) })
})

