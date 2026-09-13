import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const { recapId } = routeParams(event, 'recapId')

  const recap = await prisma.recapRecording.findUnique({
    where: { id: recapId },
    select: {
      artifactId: true,
      session: {
        select: {
          campaignId: true,
        },
      },
    },
  })
  if (!recap) {
    throw apiError(404, 'NOT_FOUND', 'Recap not found')
  }

  await requireCampaignPermission(event, recap.session.campaignId, 'content.read')

  const url = `/api/artifacts/${recap.artifactId}/stream`
  return ok({ url, expiresAt: null })
})
