import { getQuery } from 'h3'
import { ok, fail } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { adminCampaignListQuerySchema } from '#shared/schemas/admin'
import { AdminService } from '#server/services/admin.service'

const adminService = new AdminService()

export default defineEventHandler(async (event) => {
  const authz = await requireSystemAdmin(event)
  if (!authz.ok) {
    return authz.response
  }

  const parsed = adminCampaignListQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid campaigns query parameters')
  }

  const result = await adminService.listCampaigns(parsed.data)
  return ok(result)
})
