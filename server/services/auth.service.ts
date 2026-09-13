import type { H3Event } from 'h3'
import { prisma } from '#server/db/prisma'
import { apiError } from '#server/utils/http'


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
): true => {
  if (!user.isActive || user.deletedAt) {
    throw apiError(403, 'ACCOUNT_DISABLED', 'This account is not active.')
  }

  return true
}

export class AuthService {
  async register(input: { name: string; email: string; password: string }): Promise<AuthenticatedUserRecord> {
    const email = input.email.trim().toLowerCase()

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existing) {
      throw apiError(409, 'EMAIL_ALREADY_IN_USE', 'An account with this email already exists.', {
          email: 'Email is already in use',
        })
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

    return user
  }

  async authenticate(emailInput: string, password: string): Promise<AuthenticatedUserRecord> {
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
      throw apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }

    ensureUserCanAuthenticate(user)

    const isValid = await verifyPassword(user.passwordHash, password)
    if (!isValid) {
      throw apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
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

    return updated
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
