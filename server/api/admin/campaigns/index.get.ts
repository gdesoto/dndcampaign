import { validateQuery } from '#server/utils/validate'
import { ok } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { adminCampaignListQuerySchema } from '#shared/schemas/admin'
import { AdminService } from '#server/services/admin.service'

const adminService = new AdminService()

export default defineEventHandler(async (event) => {
  await requireSystemAdmin(event)

  const parsed = validateQuery(event, adminCampaignListQuerySchema, 'Invalid campaigns query parameters')

  const result = await adminService.listCampaigns(parsed)
  return ok(result)
})
