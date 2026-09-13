import { prisma } from '#server/db/prisma'
import { RecordingService } from '#server/services/recording.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { ok, apiError, routeParams } from '#server/utils/http'

const recordingService = new RecordingService()

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: {
      id: true,
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

  await requireCampaignPermission(event, recording.session.campaignId, 'recording.upload')

  await recordingService.deleteRecording(recording.id)
  return ok({ success: true })
})
