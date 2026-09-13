import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { campaignPublicAccessUpdateSchema } from '#shared/schemas/campaign-public-access'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  const authz = await requireCampaignPermission(event, campaignId, 'campaign.public.manage')

  const parsed = await validateBody(event, campaignPublicAccessUpdateSchema, 'Invalid public access payload')

  const result = await publicAccessService.updateOwnerSettings(
    campaignId,
    authz.session.user.id,
    parsed
  )
  return ok(result)
})

