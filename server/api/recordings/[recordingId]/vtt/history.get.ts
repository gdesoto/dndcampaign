import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const recordingId = event.context.params?.recordingId
  if (!recordingId) {
    return fail(400, 'VALIDATION_ERROR', 'Recording id is required')
  }

  const recording = await prisma.recording.findFirst({
    where: {
      id: recordingId,
      session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.read') },
    },
    include: { session: true },
  })
  if (!recording) {
    return fail(404, 'NOT_FOUND', 'Recording not found')
  }

  const history = await prisma.artifact.findMany({
    where: {
      campaignId: recording.session.campaignId,
      label: 'Transcript VTT',
      meta: {
        contains: `"recordingId":"${recordingId}"`,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (recording.vttArtifactId) {
    const current = await prisma.artifact.findUnique({
      where: { id: recording.vttArtifactId },
    })
    if (current && !history.find((item) => item.id === current.id)) {
      history.unshift(current)
    }
  }

  return ok(history)
})
