//import { getUserSession } from '#auth-utils'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    return fail(401, 'UNAUTHORIZED', 'Not authenticated')
  }

  return ok({ user: session.user })
})
