import { getQuery } from 'h3'
import { ok, fail } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { adminUserListQuerySchema } from '#shared/schemas/admin'
import { AdminService } from '#server/services/admin.service'

const adminService = new AdminService()

export default defineEventHandler(async (event) => {
  const authz = await requireSystemAdmin(event)
  if (!authz.ok) {
    return authz.response
  }

  const parsed = adminUserListQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid users query parameters')
  }

  const result = await adminService.listUsers(parsed.data)
  return ok(result)
})
