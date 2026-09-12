import { fail, respond } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { validateBody } from '#server/utils/validate'
import { adminCampaignUpdateSchema } from '#shared/schemas/admin'
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

  const parsed = await validateBody(event, adminCampaignUpdateSchema, 'Invalid campaign update payload')
  if (!parsed.ok) return parsed.response

  const actorUserId = (authz.session.user as { id: string }).id
  const result = await adminService.updateCampaign(campaignId, actorUserId, parsed.data)
  return respond(event, result)
})
