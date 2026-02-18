import type { H3Event } from 'h3'
import { getRequestIP, getHeader } from 'h3'
import { prisma } from '#server/db/prisma'
import { AuthService, type ServiceResult, toAuthUserDto } from '#server/services/auth.service'

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
  async getProfile(userId: string): Promise<ServiceResult<ProfileRecord>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    })

    if (!user || user.deletedAt) {
      return {
        ok: false,
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'Account not found',
      }
    }

    return { ok: true, data: user }
  }

  async updateProfile(userId: string, input: { name?: string; avatarUrl?: string | null }): Promise<ServiceResult<ProfileRecord>> {
    const existing = await this.getProfile(userId)
    if (!existing.ok) {
      return existing
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
      select: profileSelect,
    })

    return { ok: true, data: user }
  }

  async changeEmail(
    userId: string,
    input: { newEmail: string; password: string }
  ): Promise<ServiceResult<{ email: string }>> {
    const profileResult = await this.getProfile(userId)
    if (!profileResult.ok) {
      return profileResult
    }

    const current = profileResult.data
    if (!current.passwordHash) {
      return {
        ok: false,
        statusCode: 400,
        code: 'PASSWORD_REQUIRED',
        message: 'Password login is not configured for this account.',
      }
    }

    const passwordValid = await verifyPassword(current.passwordHash, input.password)
    if (!passwordValid) {
      return {
        ok: false,
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid password.',
        fields: {
          password: 'Password is incorrect',
        },
      }
    }

    const normalizedEmail = input.newEmail.trim().toLowerCase()
    if (normalizedEmail === current.email) {
      return {
        ok: true,
        data: {
          email: current.email,
        },
      }
    }

    const taken = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (taken && taken.id !== userId) {
      return {
        ok: false,
        statusCode: 409,
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'An account with this email already exists.',
        fields: {
          newEmail: 'Email is already in use',
        },
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { email: normalizedEmail },
    })

    return {
      ok: true,
      data: {
        email: normalizedEmail,
      },
    }
  }

  async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string }
  ): Promise<ServiceResult<true>> {
    const profileResult = await this.getProfile(userId)
    if (!profileResult.ok) {
      return profileResult
    }

    const current = profileResult.data
    if (!current.passwordHash) {
      return {
        ok: false,
        statusCode: 400,
        code: 'PASSWORD_REQUIRED',
        message: 'Password login is not configured for this account.',
      }
    }

    const passwordValid = await verifyPassword(current.passwordHash, input.currentPassword)
    if (!passwordValid) {
      return {
        ok: false,
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid current password.',
        fields: {
          currentPassword: 'Current password is incorrect',
        },
      }
    }

    const reusedPassword = await verifyPassword(current.passwordHash, input.newPassword)
    if (reusedPassword) {
      return {
        ok: false,
        statusCode: 400,
        code: 'PASSWORD_REUSE',
        message: 'New password must be different from the current password.',
        fields: {
          newPassword: 'New password must be different from the current password',
        },
      }
    }

    const nextPasswordHash = await hashPassword(input.newPassword)
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: nextPasswordHash },
    })

    return { ok: true, data: true }
  }

  async listSessions(event: H3Event, userId: string): Promise<ServiceResult<{ sessions: Array<Record<string, unknown>> }>> {
    const profileResult = await this.getProfile(userId)
    if (!profileResult.ok) {
      return profileResult
    }

    const session = await getUserSession(event)
    const nowIso = new Date().toISOString()

    return {
      ok: true,
      data: {
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
      },
    }
  }

  async revokeOtherSessions(event: H3Event, userId: string): Promise<ServiceResult<{ revokedSessions: number }>> {
    const profileResult = await this.getProfile(userId)
    if (!profileResult.ok) {
      return profileResult
    }

    const session = await getUserSession(event)
    const user = profileResult.data

    await setUserSession(event, {
      user: toAuthUserDto(user),
      loggedInAt: session.loggedInAt || new Date(),
    })

    return {
      ok: true,
      data: {
        revokedSessions: 0,
      },
    }
  }

  async syncSession(event: H3Event, userId: string) {
    await authService.syncSessionForUser(event, userId)
  }
}
