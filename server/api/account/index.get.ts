import { ok } from '#server/utils/http'
import { AccountService, toAccountProfileDto } from '#server/services/account.service'

const accountService = new AccountService()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  return ok({
    profile: toAccountProfileDto(await accountService.getProfile(session.user.id)),
  })
})
