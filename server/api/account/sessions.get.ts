import { ok } from '#server/utils/http'
import { AccountService } from '#server/services/account.service'

const accountService = new AccountService()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const result = await accountService.listSessions(event, session.user.id)

  return ok(result)
})
