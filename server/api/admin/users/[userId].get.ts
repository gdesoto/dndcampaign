import { ok, fail } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { AdminService } from '#server/services/admin.service'

const adminService = new AdminService()

export default defineEventHandler(async (event) => {
  const userId = event.context.params?.userId
  if (!userId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'User id is required')
  }

  const authz = await requireSystemAdmin(event)
  if (!authz.ok) {
    return authz.response
  }

  const result = await adminService.getUser(userId)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
