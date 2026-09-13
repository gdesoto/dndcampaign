import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const recordingAccess = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: {
      session: {
        select: {
          campaignId: true,
        },
      },
    },
  })
  if (!recordingAccess) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  await requireCampaignPermission(event, recordingAccess.session.campaignId, 'content.read')

  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
  })

  return ok(recording)
})



