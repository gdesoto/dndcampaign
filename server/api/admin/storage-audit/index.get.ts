import { validateQuery } from '#server/utils/validate'
import { ok } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { adminStorageAuditQuerySchema } from '#shared/schemas/admin'
import { AdminService } from '#server/services/admin.service'

const adminService = new AdminService()

export default defineEventHandler(async (event) => {
  const authz = await requireSystemAdmin(event)
  if (!authz.ok) {
    return authz.response
  }

  const parsed = validateQuery(event, adminStorageAuditQuerySchema, 'Invalid storage audit query parameters')
  if (!parsed.ok) return parsed.response

  const result = await adminService.getStorageAudit(parsed.data)
  return ok(result)
})
