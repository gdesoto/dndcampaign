import { fail, respond } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { adminUserUpdateSchema } from '#shared/schemas/admin'
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

  const parsed = await validateBody(event, adminUserUpdateSchema, 'Invalid user update payload')
  if (!parsed.ok) return parsed.response

  const actorUserId = (authz.session.user as { id: string }).id
  const result = await adminService.updateUser(userId, actorUserId, parsed.data)
  return respond(event, result)
})
