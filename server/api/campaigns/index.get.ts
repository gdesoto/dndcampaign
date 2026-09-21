import { prisma } from '#server/db/prisma'
import { ok } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { getApiAuth } from '#server/utils/api-auth'

export default defineEventHandler(async (event) => {
  const session = await requireApiUserSession(event)
  const auth = getApiAuth(event)
  const keyCampaignIds = auth?.kind === 'bearer' ? auth.key.campaigns.map((campaign) => campaign.campaignId) : undefined
  const campaigns = await prisma.campaign.findMany({
    where: { ...buildCampaignWhereForPermission(session.user.id, 'campaign.read'), ...(keyCampaignIds ? { id: { in: keyCampaignIds } } : {}) },
    orderBy: { updatedAt: 'desc' },
  })

  return ok(campaigns)
})

