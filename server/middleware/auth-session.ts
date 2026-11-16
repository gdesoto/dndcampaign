import { getCookie, getMethod, getRequestURL } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { apiError } from '#server/utils/http'
import { toAuthUserDto } from '#server/services/auth.service'

// These requests start or end a session, so they proceed once a stale cookie is cleared.
const sessionEntryPaths = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/logout'])

/**
 * Sealed session cookies are stateless, so re-check the account on every cookie API request:
 * disabling, deleting, or revoking sessions takes effect immediately, and the cookie is resealed
 * only when the stored profile (including systemRole) changed. nuxt/server caches the unsealed
 * session per event, so later getUserSession/requireUserSession calls see the replaced data.
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/') || !getCookie(event, USER_SESSION_COOKIE_NAME)) return

  const session = await getUserSession(event)
  if (!session.user) return

  const user = db.query.user.findFirst({
    where: eq(tables.user.id, session.user.id),
    columns: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      avatarUrl: true,
      isActive: true,
      deletedAt: true,
      sessionsValidAfter: true,
    },
  }).sync()
  const loggedInAt = session.loggedInAt ? new Date(session.loggedInAt).getTime() : 0

  if (!user || !user.isActive || user.deletedAt || (user.sessionsValidAfter && loggedInAt < user.sessionsValidAfter.getTime())) {
    await clearUserSession(event)
    if (sessionEntryPaths.has(path) || (path === '/api/_auth/session' && getMethod(event) === 'DELETE')) return
    throw apiError(401, 'UNAUTHORIZED', 'Not authenticated')
  }

  const current = toAuthUserDto(user)
  if (JSON.stringify(current) !== JSON.stringify(session.user)) {
    await replaceUserSession(event, { user: current, loggedInAt: session.loggedInAt })
  }
})
