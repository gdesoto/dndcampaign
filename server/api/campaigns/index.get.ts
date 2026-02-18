import { prisma } from '#server/db/prisma'
import { ok } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaigns = await prisma.campaign.findMany({
    where: buildCampaignWhereForPermission(session.user.id, 'campaign.read'),
    orderBy: { updatedAt: 'desc' },
  })

  return ok(campaigns)
})

