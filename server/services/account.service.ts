import type { H3Event } from 'h3'
import { getRequestIP, getHeader } from 'h3'
import { prisma } from '#server/db/prisma'
import { AuthService, toAuthUserDto } from '#server/services/auth.service'
import { apiError } from '#server/utils/http'

const authService = new AuthService()

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
    return prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    })
  }

  async getProfile(userId: string): Promise<ProfileRecord> {
    const user = await this.findProfile(userId)

    if (!user || user.deletedAt) {
      throw apiError(404, 'USER_NOT_FOUND', 'Account not found')
    }

    return user
  }

  async getActiveProfile(userId: string): Promise<ProfileRecord | null> {
    const user = await this.findProfile(userId)
    return user && user.isActive && !user.deletedAt ? user : null
  }

  async updateProfile(userId: string, input: { name?: string; avatarUrl?: string | null }): Promise<ProfileRecord> {
    await this.getProfile(userId)

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
      select: profileSelect,
    })

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

    const taken = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (taken && taken.id !== userId) {
      throw apiError(409, 'EMAIL_ALREADY_IN_USE', 'An account with this email already exists.', {
          newEmail: 'Email is already in use',
        })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { email: normalizedEmail },
    })

    return {
        email: normalizedEmail,
      }
  }

  async changePassword(
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
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: nextPasswordHash },
    })

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

  async revokeOtherSessions(event: H3Event, userId: string): Promise<{ revokedSessions: number }> {
    const profileResult = await this.getProfile(userId)

    const session = await getUserSession(event)
    const user = profileResult

    await setUserSession(event, {
      user: toAuthUserDto(user),
      loggedInAt: session.loggedInAt || new Date(),
    })

    return {
        revokedSessions: 0,
      }
  }

  async syncSession(event: H3Event, userId: string) {
    await authService.syncSessionForUser(event, userId)
  }
}
