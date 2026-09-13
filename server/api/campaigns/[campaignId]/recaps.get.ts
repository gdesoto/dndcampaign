import { prisma } from '#server/db/prisma'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.read')

  const recaps = await prisma.recapRecording.findMany({
    where: { session: { campaignId } },
    include: {
      session: {
        select: {
          id: true,
          title: true,
          sessionNumber: true,
          playedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok(recaps)
})
