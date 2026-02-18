import type { H3Event } from 'h3'
import { prisma } from '#server/db/prisma'

export type ServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      statusCode: number
      code: string
      message: string
      fields?: Record<string, string>
    }

type AuthenticatedUserRecord = {
  id: string
  email: string
  name: string
  systemRole: 'USER' | 'SYSTEM_ADMIN'
  avatarUrl: string | null
  isActive: boolean
  deletedAt: Date | null
}

export type AuthUserDto = {
  id: string
  email: string
  name: string
  systemRole: 'USER' | 'SYSTEM_ADMIN'
  avatarUrl: string | null
}

export const toAuthUserDto = (user: AuthenticatedUserRecord): AuthUserDto => ({
  id: user.id,
  email: user.email,
  name: user.name,
  systemRole: user.systemRole,
  avatarUrl: user.avatarUrl,
})

const toSessionUser = (user: AuthenticatedUserRecord): AuthUserDto => toAuthUserDto(user)

const ensureUserCanAuthenticate = (
  user: Pick<AuthenticatedUserRecord, 'isActive' | 'deletedAt'>
): ServiceResult<true> => {
  if (!user.isActive || user.deletedAt) {
    return {
      ok: false,
      statusCode: 403,
      code: 'ACCOUNT_DISABLED',
      message: 'This account is not active.',
    }
  }

  return { ok: true, data: true }
}

export class AuthService {
  async register(input: { name: string; email: string; password: string }): Promise<ServiceResult<AuthenticatedUserRecord>> {
    const email = input.email.trim().toLowerCase()

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existing) {
      return {
        ok: false,
        statusCode: 409,
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'An account with this email already exists.',
        fields: {
          email: 'Email is already in use',
        },
      }
    }

    const passwordHash = await hashPassword(input.password)

    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        lastLoginAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        systemRole: true,
        avatarUrl: true,
        isActive: true,
        deletedAt: true,
      },
    })

    return { ok: true, data: user }
  }

  async authenticate(emailInput: string, password: string): Promise<ServiceResult<AuthenticatedUserRecord>> {
    const email = emailInput.trim().toLowerCase()

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        systemRole: true,
        avatarUrl: true,
        isActive: true,
        deletedAt: true,
      },
    })

    if (!user || !user.passwordHash) {
      return {
        ok: false,
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      }
    }

    const accountState = ensureUserCanAuthenticate(user)
    if (!accountState.ok) {
      return accountState
    }

    const isValid = await verifyPassword(user.passwordHash, password)
    if (!isValid) {
      return {
        ok: false,
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      }
    }

    const shouldRehash = await passwordNeedsReHash(user.passwordHash)
    const passwordHash = shouldRehash ? await hashPassword(password) : undefined

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(passwordHash ? { passwordHash } : {}),
        lastLoginAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        systemRole: true,
        avatarUrl: true,
        isActive: true,
        deletedAt: true,
      },
    })

    return { ok: true, data: updated }
  }

  async refreshSession(event: H3Event, user: AuthenticatedUserRecord, loggedInAt?: Date) {
    await setUserSession(event, {
      user: toSessionUser(user),
      loggedInAt: loggedInAt || new Date(),
    })
  }

  async syncSessionForUser(event: H3Event, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        systemRole: true,
        avatarUrl: true,
        isActive: true,
        deletedAt: true,
      },
    })

    if (!user) {
      return
    }

    const session = await getUserSession(event)
    await replaceUserSession(event, {
      user: toSessionUser(user),
      loggedInAt: session.loggedInAt || new Date(),
    })
  }
}
