//import { clearUserSession } from '#auth-utils'
import { ok } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  return ok({ success: true })
})
