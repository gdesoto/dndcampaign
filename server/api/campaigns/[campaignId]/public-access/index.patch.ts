import { fail, ok } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
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

  const parsed = await readValidatedBodySafe(event, campaignPublicAccessUpdateSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid public access payload', parsed.fieldErrors)
  }

  const result = await publicAccessService.updateOwnerSettings(
    campaignId,
    authz.session.user.id,
    parsed.data
  )
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
