import { ok, fail } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { readValidatedBodySafe } from '#server/utils/validate'
import { adminStorageAuditFixSchema } from '#shared/schemas/admin'
import { AdminService } from '#server/services/admin.service'

const adminService = new AdminService()

export default defineEventHandler(async (event) => {
  const authz = await requireSystemAdmin(event)
  if (!authz.ok) {
    return authz.response
  }

  const parsed = await readValidatedBodySafe(event, adminStorageAuditFixSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid storage audit fix payload', parsed.fieldErrors)
  }

  const actorUserId = (authz.session.user as { id: string }).id
  const result = await adminService.applyStorageAuditFix(actorUserId, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
