import type { H3Event } from 'h3'
import { getRequestIP, getHeader } from 'h3'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq } from 'drizzle-orm'
import { apiError } from '#server/utils/http'

type ProfileRecord = {
  id: string
  email: string
  name: string
  systemRole: 'USER' | 'SYSTEM_ADMIN'
  avatarUrl: string | null
  isActive: boolean
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
  passwordHash: string | null
}

export const toAccountProfileDto = (profile: ProfileRecord) => ({
  id: profile.id,
  email: profile.email,
  name: profile.name,
  systemRole: profile.systemRole,
  avatarUrl: profile.avatarUrl,
  isActive: profile.isActive,
  createdAt: profile.createdAt.toISOString(),
  updatedAt: profile.updatedAt.toISOString(),
})

const profileSelect = {
  id: true,
  email: true,
  name: true,
  systemRole: true,
  avatarUrl: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
} as const

export class AccountService {
  private async findProfile(userId: string): Promise<ProfileRecord | null> {
    return db.query.user.findFirst({
      where: eq(tables.user.id, userId),
      columns: profileSelect
    }).sync() ?? null
  }

  async getProfile(userId: string): Promise<ProfileRecord> {
    const user = await this.findProfile(userId)

    if (!user || user.deletedAt) {
      throw apiError(404, 'USER_NOT_FOUND', 'Account not found')
    }

    return user
  }

  async updateProfile(userId: string, input: { name?: string; avatarUrl?: string | null }): Promise<ProfileRecord> {
    await this.getProfile(userId)

    const user = await db.update(tables.user).set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {})
    }).where(eq(tables.user.id, userId)).returning().get()!

    return user
  }

  async changeEmail(
    userId: string,
    input: { newEmail: string; password: string }
  ): Promise<{ email: string }> {
    const profileResult = await this.getProfile(userId)

    const current = profileResult
    if (!current.passwordHash) {
      throw apiError(400, 'PASSWORD_REQUIRED', 'Password login is not configured for this account.')
    }

    const passwordValid = await verifyPassword(current.passwordHash, input.password)
    if (!passwordValid) {
      throw apiError(401, 'INVALID_CREDENTIALS', 'Invalid password.', {
          password: 'Password is incorrect',
        })
    }

    const normalizedEmail = input.newEmail.trim().toLowerCase()
    if (normalizedEmail === current.email) {
      return {
          email: current.email,
        }
    }

    const taken = await db.query.user.findFirst({
      where: eq(tables.user.email, normalizedEmail),
      columns: { id: true }
    }).sync()

    if (taken && taken.id !== userId) {
      throw apiError(409, 'EMAIL_ALREADY_IN_USE', 'An account with this email already exists.', {
          newEmail: 'Email is already in use',
        })
    }

    await db.update(tables.user).set({ email: normalizedEmail }).where(eq(tables.user.id, userId)).returning().get()!

    return {
        email: normalizedEmail,
      }
  }

  async changePassword(
    event: H3Event,
    userId: string,
    input: { currentPassword: string; newPassword: string }
  ): Promise<true> {
    const profileResult = await this.getProfile(userId)

    const current = profileResult
    if (!current.passwordHash) {
      throw apiError(400, 'PASSWORD_REQUIRED', 'Password login is not configured for this account.')
    }

    const passwordValid = await verifyPassword(current.passwordHash, input.currentPassword)
    if (!passwordValid) {
      throw apiError(401, 'INVALID_CREDENTIALS', 'Invalid current password.', {
          currentPassword: 'Current password is incorrect',
        })
    }

    const reusedPassword = await verifyPassword(current.passwordHash, input.newPassword)
    if (reusedPassword) {
      throw apiError(400, 'PASSWORD_REUSE', 'New password must be different from the current password.', {
          newPassword: 'New password must be different from the current password',
        })
    }

    const nextPasswordHash = await hashPassword(input.newPassword)
    const now = new Date()
    db.update(tables.user).set({ passwordHash: nextPasswordHash, sessionsValidAfter: now }).where(eq(tables.user.id, userId)).run()
    await setUserSession(event, { loggedInAt: now })

    return true
  }

  async listSessions(event: H3Event, userId: string): Promise<{ sessions: Array<Record<string, unknown>> }> {
    await this.getProfile(userId)

    const session = await getUserSession(event)
    const nowIso = new Date().toISOString()

    return {
        sessions: [
          {
            id: session.id || 'current',
            isCurrent: true,
            userAgent: getHeader(event, 'user-agent') || null,
            ipAddress: getRequestIP(event, { xForwardedFor: true }) || null,
            loggedInAt: session.loggedInAt ? new Date(session.loggedInAt).toISOString() : null,
            lastSeenAt: nowIso,
          },
        ],
      }
  }

  /** Cookies are stateless, so sign out everything issued before now and re-issue this device's cookie. */
  async revokeOtherSessions(event: H3Event, userId: string): Promise<true> {
    await this.getProfile(userId)

    const now = new Date()
    db.update(tables.user).set({ sessionsValidAfter: now }).where(eq(tables.user.id, userId)).run()
    await setUserSession(event, { loggedInAt: now })

    return true
  }
}
