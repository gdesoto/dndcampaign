import { ok, apiError } from '#server/utils/http'

// server/middleware/auth-session.ts has already checked the account and synced the session user.
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw apiError(401, 'UNAUTHORIZED', 'Not authenticated')
  }

  return ok({ user: session.user })
})
