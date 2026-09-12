import { z } from 'zod'
import { ok, fail, respond } from '#server/utils/http'
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
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid account action payload', {
      action: 'Unsupported or missing action',
    })
  }

  const action = actionParsed.data.action

  if (action === 'update-profile') {
    const parsed = validateInput(event, accountProfileUpdateSchema, body, 'Invalid profile payload')
    if (!parsed.ok) return parsed.response

    const result = await accountService.updateProfile(session.user.id, parsed.data)
    if (!result.ok) {
      return respond(event, result)
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
  }

  if (action === 'change-email') {
    const parsed = validateInput(event, changeEmailSchema, body, 'Invalid email payload')
    if (!parsed.ok) return parsed.response

    const result = await accountService.changeEmail(session.user.id, parsed.data)
    if (!result.ok) {
      return respond(event, result)
    }

    await accountService.syncSession(event, session.user.id)
    return ok({ email: result.data.email })
  }

  if (action === 'change-password') {
    const parsed = validateInput(event, changePasswordSchema, body, 'Invalid password payload')
    if (!parsed.ok) return parsed.response

    const result = await accountService.changePassword(session.user.id, parsed.data)
    if (!result.ok) {
      return respond(event, result)
    }

    return ok({ success: true })
  }

  const result = await accountService.revokeOtherSessions(event, session.user.id)
  return respond(event, result)
})
