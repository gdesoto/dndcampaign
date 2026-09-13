import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: {
      artifactId: true,
      session: {
        select: {
          campaignId: true,
        },
      },
    },
  })
  if (!recording) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  await requireCampaignPermission(event, recording.session.campaignId, 'content.read')

  const url = `/api/artifacts/${recording.artifactId}/stream`
  return ok({ url, expiresAt: null })
})
