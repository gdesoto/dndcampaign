import { respond } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { adminStorageAuditFixSchema } from '#shared/schemas/admin'
import { AdminService } from '#server/services/admin.service'

const adminService = new AdminService()

export default defineEventHandler(async (event) => {
  const authz = await requireSystemAdmin(event)
  if (!authz.ok) {
    return authz.response
  }

  const parsed = await validateBody(event, adminStorageAuditFixSchema, 'Invalid storage audit fix payload')
  if (!parsed.ok) return parsed.response

  const actorUserId = (authz.session.user as { id: string }).id
  const result = await adminService.applyStorageAuditFix(actorUserId, parsed.data)
  return respond(event, result)
})
