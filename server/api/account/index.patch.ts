import { z } from 'zod'
import { ok, apiError } from '#server/utils/http'
import { validateInput } from '#server/utils/validate'
import { AccountService } from '#server/services/account.service'
import {
  accountProfileUpdateSchema,
  changeEmailSchema,
  changePasswordSchema,
} from '#shared/schemas/auth'

const accountService = new AccountService()

const accountActionSchema = z.object({
  action: z.enum([
    'update-profile',
    'change-email',
    'change-password',
    'revoke-other-sessions',
  ]),
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = ((await readBody(event).catch(() => ({}))) ?? {}) as Record<string, unknown>
  const actionParsed = accountActionSchema.safeParse(body)

  if (!actionParsed.success) {
    throw apiError(400, 'VALIDATION_ERROR', 'Invalid account action payload', {
      action: 'Unsupported or missing action',
    })
  }

  const action = actionParsed.data.action

  if (action === 'update-profile') {
    const parsed = validateInput(accountProfileUpdateSchema, body, 'Invalid profile payload')

    const result = await accountService.updateProfile(session.user.id, parsed)

    await accountService.syncSession(event, session.user.id)
    const profile = result
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
  }

  if (action === 'change-email') {
    const parsed = validateInput(changeEmailSchema, body, 'Invalid email payload')

    const result = await accountService.changeEmail(session.user.id, parsed)

    await accountService.syncSession(event, session.user.id)
    return ok({ email: result.email })
  }

  if (action === 'change-password') {
    const parsed = validateInput(changePasswordSchema, body, 'Invalid password payload')

    await accountService.changePassword(session.user.id, parsed)

    return ok({ success: true })
  }

  const result = await accountService.revokeOtherSessions(event, session.user.id)
  return ok(result)
})
