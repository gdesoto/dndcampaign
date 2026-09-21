import type { H3Event } from 'h3'
import { getHeader } from 'h3'
import type { UserSessionRequired } from '#auth-utils'
import { apiError } from '#server/utils/http'
import { apiKeyService, type ApiKeyAuth } from '#server/services/api-key.service'

export type ApiAuthContext = { kind: 'cookie' } | { kind: 'bearer'; key: ApiKeyAuth }

/** Shared request identity boundary for API routes that explicitly opt into bearer keys. */
export const requireApiUserSession = async (event: H3Event): Promise<UserSessionRequired> => {
  if (event.context.apiSession) return event.context.apiSession as UserSessionRequired
  const secret = getBearerSecret(event)
  if (secret) {
    const key = await apiKeyService.authenticate(secret)
    if (!key) throw apiError(401, 'UNAUTHORIZED', 'Invalid, expired, or revoked API key')
    const session = { id: `api-key:${key.id}`, user: { id: key.user.id, email: key.user.email, name: key.user.name, systemRole: 'USER' as const, avatarUrl: key.user.avatarUrl } }
    event.context.apiAuth = { kind: 'bearer', key } satisfies ApiAuthContext
    event.context.apiSession = session
    return session
  }
  const session = await requireUserSession(event)
  event.context.apiAuth = { kind: 'cookie' } satisfies ApiAuthContext
  event.context.apiSession = session
  return session
}

export const getBearerSecret = (event: H3Event) => {
  const value = getHeader(event, 'authorization')
  if (!value) return null
  const match = /^Bearer\s+([^\s]+)$/i.exec(value)
  if (!match) throw apiError(401, 'UNAUTHORIZED', 'Invalid authorization header')
  return match[1]
}

export const getApiAuth = (event: H3Event): ApiAuthContext | undefined => event.context.apiAuth

export const requireCookieSession = async (event: H3Event) => {
  if (getBearerSecret(event)) throw apiError(403, 'FORBIDDEN', 'API keys cannot access account management')
  return requireUserSession(event)
}
