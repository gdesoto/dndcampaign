import { ok, fail } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { AdminService } from '#server/services/admin.service'

const adminService = new AdminService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireSystemAdmin(event)
  if (!authz.ok) {
    return authz.response
  }

  const result = await adminService.getCampaign(campaignId)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
