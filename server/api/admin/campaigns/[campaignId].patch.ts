import { ok, routeParams } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { adminCampaignUpdateSchema } from '#shared/schemas/admin'
import { AdminService } from '#server/services/admin.service'

const adminService = new AdminService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const authz = await requireSystemAdmin(event)

  const parsed = await validateBody(event, adminCampaignUpdateSchema, 'Invalid campaign update payload')

  const actorUserId = (authz.session.user as { id: string }).id
  const result = await adminService.updateCampaign(campaignId, actorUserId, parsed)
  return ok(result)
})
