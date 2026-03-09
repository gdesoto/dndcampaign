import { prisma } from '#server/db/prisma'
import { RecordingService } from '#server/services/recording.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { ok, fail } from '#server/utils/http'

const recordingService = new RecordingService()

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const recordingId = event.context.params?.recordingId
  if (!recordingId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Recording id is required')
  }

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
    return fail(event, 404, 'NOT_FOUND', 'Recording not found')
  }

  const access = await requireCampaignPermission(event, recording.session.campaignId, 'recording.upload')
  if (!access.ok) {
    return access.response
  }

  await recordingService.deleteRecording(recording.id)
  return ok({ success: true })
})
