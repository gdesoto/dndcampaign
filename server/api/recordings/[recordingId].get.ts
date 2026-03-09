import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const recordingId = event.context.params?.recordingId
  if (!recordingId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Recording id is required')
  }

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
    return fail(event, 404, 'NOT_FOUND', 'Recording not found')
  }

  const access = await requireCampaignPermission(event, recordingAccess.session.campaignId, 'content.read')
  if (!access.ok) {
    return access.response
  }

  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
  })

  return ok(recording)
})



