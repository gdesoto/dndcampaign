import { ok, respond } from '#server/utils/http'
import { AccountService } from '#server/services/account.service'

const accountService = new AccountService()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const result = await accountService.getProfile(session.user.id)

  if (!result.ok) {
    return respond(event, result)
  }

  const profile = result.data
  return ok({
    profile: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      systemRole: profile.systemRole,
      avatarUrl: profile.avatarUrl,
      isActive: profile.isActive,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    },
  })
})
