import { ok, routeParams } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { AdminService } from '#server/services/admin.service'

const adminService = new AdminService()

export default defineEventHandler(async (event) => {
  const { userId } = routeParams(event, 'userId')

  await requireSystemAdmin(event)

  const result = await adminService.getUser(userId)
  return ok(result)
})
