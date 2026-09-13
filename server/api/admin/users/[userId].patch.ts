import { ok, routeParams } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { adminUserUpdateSchema } from '#shared/schemas/admin'
import { AdminService } from '#server/services/admin.service'

const adminService = new AdminService()

export default defineEventHandler(async (event) => {
  const { userId } = routeParams(event, 'userId')

  const authz = await requireSystemAdmin(event)

  const parsed = await validateBody(event, adminUserUpdateSchema, 'Invalid user update payload')

  const actorUserId = (authz.session.user as { id: string }).id
  const result = await adminService.updateUser(userId, actorUserId, parsed)
  return ok(result)
})
