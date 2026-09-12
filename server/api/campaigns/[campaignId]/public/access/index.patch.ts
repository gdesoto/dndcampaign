import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { campaignPublicAccessUpdateSchema } from '#shared/schemas/campaign-public-access'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.public.manage')
  if (!authz.ok) {
    return authz.response
  }

  const parsed = await validateBody(event, campaignPublicAccessUpdateSchema, 'Invalid public access payload')
  if (!parsed.ok) return parsed.response

  const result = await publicAccessService.updateOwnerSettings(
    campaignId,
    authz.session.user.id,
    parsed.data
  )
  return respond(event, result)
})

