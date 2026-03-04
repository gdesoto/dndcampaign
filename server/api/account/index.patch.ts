import { z } from 'zod'
import { ok, fail } from '#server/utils/http'
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
    const parsed = accountProfileUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const fields: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'profile'
        fields[key] = issue.message
      }
      return fail(event, 400, 'VALIDATION_ERROR', 'Invalid profile payload', fields)
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
  }

  if (action === 'change-email') {
    const parsed = changeEmailSchema.safeParse(body)
    if (!parsed.success) {
      const fields: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'changeEmail'
        fields[key] = issue.message
      }
      return fail(event, 400, 'VALIDATION_ERROR', 'Invalid email payload', fields)
    }

    const result = await accountService.changeEmail(session.user.id, parsed.data)
    if (!result.ok) {
      return fail(event, result.statusCode, result.code, result.message, result.fields)
    }

    await accountService.syncSession(event, session.user.id)
    return ok({ email: result.data.email })
  }

  if (action === 'change-password') {
    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) {
      const fields: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'changePassword'
        fields[key] = issue.message
      }
      return fail(event, 400, 'VALIDATION_ERROR', 'Invalid password payload', fields)
    }

    const result = await accountService.changePassword(session.user.id, parsed.data)
    if (!result.ok) {
      return fail(event, result.statusCode, result.code, result.message, result.fields)
    }

    return ok({ success: true })
  }

  const result = await accountService.revokeOtherSessions(event, session.user.id)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
