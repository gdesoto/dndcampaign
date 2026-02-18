import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { accountProfileUpdateSchema } from '#shared/schemas/auth'
import { AccountService } from '#server/services/account.service'

const accountService = new AccountService()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const parsed = await readValidatedBodySafe(event, accountProfileUpdateSchema)

  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid profile payload', parsed.fieldErrors)
  }

  const result = await accountService.updateProfile(session.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  await accountService.syncSession(event, session.user.id)

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
